'use strict';

angular.module('dwtApp').controller('AddEditLoadCtrl', [
    '$scope', 'apiService', '$stateParams', '$state', '$q', '$modal', '$window', '_', 'moment', 'ngToast', 'enums', 'constants', 'postcodeValidation', 'unsavedChangesService', 'dimensionService', 'userService', 'modalService',
    function ($scope, apiService, $stateParams, $state, $q, $modal, $window, _, moment, ngToast, enums, constants, postcodeValidation, unsavedChangesService, dimensionService, userService, modalService) {

        //// VARIABLES ////

        $scope.jobId = $stateParams.jobId;
        $scope.edit = $stateParams.loadId !== undefined;
        $scope.loaded = true;
        $scope.cdDateOpened = false;
        $scope.isSubcontracted = false;
        $scope.allowCreateInvoice = false; //Added a flag in case we need to enable this from the load screen. PROT-6074
        $scope.isDepotDisabled = false;
        $scope.pending = enums.loadStatus.pending;
        var user = {};

        $scope.load = {
            cdAddress: {},
            ddAddress: {},
            cdIsAnyTime: true,
            ddIsAnyTime: true,
            goodsItems: [],
        };

        $scope.costsTotal = 0;
        $scope.loadIsEnquiryOrProvisionalOrNotPlanned = false;
        $scope.saving = false;
        $scope.depotDisabledTooltip = 'Covered By';
        // one or more forward-slash-separated telephone numbers
        $scope.multipleTelephonePattern = /^(?:(?:\s?\+)?\s?\d[\d\s]*\/)*(?:\s?\+)?\s?\d[\d\s]*$/;

        if (!$scope.edit) {
            $scope.load.jobQuoteAccepted = $stateParams.jobQuoteAccepted;
            $scope.load.jobProvisionallyBooked = $stateParams.jobProvisionallyBooked;
            $scope.load.cdHoursAllowedOnSite = 1;
            $scope.load.ddHoursAllowedOnSite = 1;
        }


        //// HELPER FUNCTIONS ////

        function loadData () {
            var promises = [];

            var deliveryStatusPromise = apiService.deliveryStatus.getDeliveryStatuses().$promise;

            var cdCompanyAddressesPromise;
            var ddCompanyAddressesPromise;

            var userPromise = userService.getUser();
            promises.push(userPromise);

            userPromise.then(function (result) {
                user = result;
            });

            var depotsPromise = apiService.depot.getDepotsSimple().$promise;
            promises.push(depotsPromise);
            promises.push(deliveryStatusPromise);

            depotsPromise.then(function (result) {
                $scope.depots = result;
            });

            var jobPromise = apiService.job.getJobSimple({ id: $scope.jobId }).$promise;
            promises.push(jobPromise);

            jobPromise.then(function (result) {
                if (!$scope.edit) {
                    $scope.load.depot = result.owningDepot;
                }

                cdCompanyAddressesPromise = apiService.address.getAddressesForCustomer({ customerId: result.customerId, collection: true, delivery: true }).$promise;
                ddCompanyAddressesPromise = apiService.address.getAddressesForCustomer({ customerId: result.customerId, collection: true, delivery: true }).$promise;

                cdCompanyAddressesPromise.then(function (cdResult) {
                    $scope.cdCompanyAddresses = cdResult;
                    for (var i = 0; i < cdResult.length; i++) {
                        $scope.cdCompanyAddresses[i].addressLines = [cdResult[i].name, cdResult[i].address.postTown];
                    }
                });

                ddCompanyAddressesPromise.then(function (ddResult) {
                    $scope.ddCompanyAddresses = ddResult;
                    for (var i = 0; i < ddResult.length; i++) {
                        $scope.ddCompanyAddresses[i].addressLines = [ddResult[i].name, ddResult[i].address.postTown];
                    }
                });

            });

            deliveryStatusPromise.then(function (result) {
                $scope.deliveryStatuses = result;
            });

            var vehicleTypesPromise = apiService.vehicleType.getRequiredVehicleTypes().$promise;

            promises.push(vehicleTypesPromise);

            vehicleTypesPromise.then(function (result) {
                $scope.vehicleTypes = result;
            });

            var subcontractorPromise = apiService.subcontractor.getSubcontractors().$promise;

            promises.push(subcontractorPromise);

            subcontractorPromise.then(function (subcontractors) {
                $scope.subcontractors = subcontractors;
            });

            var subcontractorContactDetailsPromise = apiService.subcontractor.getSubcontractorContactDetails().$promise;

            promises.push(subcontractorContactDetailsPromise);

            subcontractorContactDetailsPromise.then(function (subcontractorContactDetails) {
                $scope.allSubcontractorContactDetails = subcontractorContactDetails;
            });

            apiService.subcontractor.getSubcontractorContactDetails().$promise.then(function (subcontractorContactDetails) {
                $scope.subcontractorContactDetails = subcontractorContactDetails;
            });

            if ($scope.edit) {

                if ($stateParams.created) {
                    ngToast.success('The load has been added.');
                }

                $scope.loaded = false;

                var loadPromise = apiService.job.getLoad({ jobId: $stateParams.jobId, loadId: $stateParams.loadId }).$promise;

                promises.push(loadPromise);

                loadPromise.then(function (result) {
                    $scope.master.subtitle = result.loadReference;
                    $scope.load = result;

                    if (result.loadStatusId === enums.loadStatus.planned && result.plannedDriver === '') {
                        result.plannedDriver = 'No Assigned Driver';
                    }

                    $scope.isSubcontracted = $scope.load.subcontractor !== null && $scope.load.subcontractor !== undefined;

                    if ($scope.load.cdDateTime) {
                        $scope.load.cdDateTime = moment(result.cdDateTime).toDate();
                    }

                    if (!$scope.load.cdIsAnyTime) {
                        $scope.cdTimeValue = $scope.load.cdDateTime;
                    }

                    if ($scope.load.cdDateTime && ($scope.load.cdDateTime.getFullYear() === (new Date(constants.minimumDateString)).getFullYear())) {
                        $scope.load.cdDateTime = null;
                    }

                    if ($scope.load.ddDateTime) {
                        $scope.load.ddDateTime = moment(result.ddDateTime).toDate();
                    }

                    if (!$scope.load.ddIsAnyTime) {
                        $scope.ddTimeValue = $scope.load.ddDateTime;
                    }

                    if ($scope.load.ddDateTime && ($scope.load.ddDateTime.getFullYear() === (new Date(constants.minimumDateString)).getFullYear())) {
                        $scope.load.ddDateTime = null;
                    }

                    $scope.checkDepotDisabled();
                });
            }

            var combinedPromise = $q.all(promises);

            combinedPromise.then(function (values) {
                $scope.loaded = true;

                if (!$scope.edit) {
                    $scope.load.deliveryStatus = _.find($scope.deliveryStatuses, function (deliveryStatus) {
                        return deliveryStatus.id === enums.deliveryStatus.notDelivered;
                    });
                }
            });

            return combinedPromise;
        }

        var loadPermissions = function () {
            var relevantSystemPortionIds = [enums.systemPortion.keyAccountManagement, enums.systemPortion.editPlan, enums.systemPortion.editPlanAllDepots];

            apiService.user.canAccessEach({ systemPortionIds: relevantSystemPortionIds }).$promise.then(function (result) {
                $scope.canSetKAMComplete = _.contains(result.canAccess, enums.systemPortion.keyAccountManagement);
                $scope.canSetDMComplete = _.intersection(result.canAccess, [enums.systemPortion.editPlan, enums.systemPortion.editPlanAllDepots]).length > 0;
            });
        };

        function addEditGoodsItem (goodsItem) {
            if (checkFormValid()) {
                unsavedChangesService.doActionWithChecks(function () {
                    openEditGoodsItemModal(goodsItem);
                });
            }
        }

        function openEditGoodsItemModal (goodsItem) {
            goodsItem = goodsItem || { metricDimensions: false };

            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'jobs/loads/goodsItems/edit-goodsitem-modal.html',
                controller: 'EditGoodsItemCtrl',
                backdrop: 'static',
                size: 'goods',
                resolve: {
                    goodsItem: function () {
                        return _.clone(goodsItem);
                    },
                    load: function () {
                        return $scope.load;
                    },
                    jobId: function () {
                        return $scope.jobId;
                    }
                }
            });

            modalInstance.result
                .then(function (result) {
                    if (result.edit) {
                        angular.copy(result.goodsItem, goodsItem);

                        goodsItem.lengthDimension = result.goodsItem.lengthDimension;
                        goodsItem.widthDimension = result.goodsItem.widthDimension;
                        goodsItem.heightDimension = result.goodsItem.heightDimension;
                    }
                    else {
                        $scope.load.goodsItems.push(result.goodsItem);
                    }
                })
                .finally(function () {
                    if (!$scope.edit) {
                        $state.transitionTo('auth.master.jobs.job.loads.edit', { jobId: $scope.jobId, loadId: $scope.load.id });
                    }
                });
        }

        function openCopyLoadModal () {
            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'jobs/loads/add-edit-load-copy-modal.html',
                controller: 'CopyLoadCtrl',
                backdrop: 'static',
                size: 'sm',
                resolve: {
                    jobId: function () {
                        return $scope.jobId;
                    },
                    loadId: function () {
                        return $scope.load.id;
                    },
                }
            });

            modalInstance.result
             .then(function (result) {
                 $state.transitionTo('auth.master.jobs.job.loads.edit', { jobId: $scope.jobId, loadId: result });
             });
        }

        function openSubcontractModal () {
            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'jobs/loads/subcontract-load-modal.html',
                controller: 'SubcontractLoadModalCtrl',
                backdrop: 'static',
                size: 'subcontract',
                resolve: {
                    load: function () {
                        return angular.copy($scope.load);
                    },
                    jobId: function () {
                        return $scope.jobId;
                    },
                }
            });

            modalInstance.result.then(function (load) {
                // add new subcontractors to subcontractor collection
                if (_.where($scope.subcontractors, { id: load.subcontractor.id }).length === 0) {
                    $scope.subcontractors.push(load.subcontractor);
                }

                // add new subcontractor contact details to subcontractor collection
                if (_.where($scope.subcontractorContactDetails, { id: load.subcontractorContactDetails.id }).length === 0) {
                    $scope.subcontractorContactDetails.push(load.subcontractorContactDetails);
                }

                $scope.load.loadStatusId = load.loadStatusId;
                $scope.load.loadStatus = load.loadStatus;
                $scope.load.subcontractor = load.subcontractor;
                $scope.load.subcontractorContactDetails = load.subcontractorContactDetails;
                $scope.load.plannedVehicleFleetNo = null;
                $scope.load.plannedDriver = null;
                $scope.isSubcontracted = true;
            });
        }

        var checkFormValid = function () {
            $scope.$broadcast('show-errors-check-validity');
            return !$scope.loadForm.$invalid;
        };

        var getSubcontractor = function () {
            var subcontractor;

            if (typeof ($scope.load.subcontractor) === 'string') {
                subcontractor = _.findWhere($scope.subcontractors, { name: $scope.load.subcontractor });

                if (subcontractor === undefined) {
                    subcontractor = { name: $scope.load.subcontractor };
                }
            }
            else {
                subcontractor = $scope.load.subcontractor;
            }

            return subcontractor;
        };

        var getSubcontractorContactDetails = function () {
            var subcontractorContactDetails;

            if (typeof ($scope.load.subcontractorContactDetails) === 'string') {
                subcontractorContactDetails = _.findWhere($scope.subcontractorContactDetails, { details: $scope.load.subcontractorContactDetails });

                if (subcontractorContactDetails === undefined) {
                    subcontractorContactDetails = { details: $scope.load.subcontractorContactDetails, subcontractorId: $scope.load.subcontractor.id };
                }
            }
            else {
                subcontractorContactDetails = $scope.load.subcontractorContactDetails;
            }

            return subcontractorContactDetails;
        };

        var saveInternal = function () {
            var confirmRemovalOfChangeNotification;

            if ($scope.load.deliveryStatus.id !== enums.deliveryStatus.notDelivered && $scope.load.hasChangesForNotification) {
                var modalParams = {
                    cancelButtonText: 'No',
                    okButtonText: 'Yes',
                    headerText: 'Remove Change Notification',
                    bodyText: 'This change to the delivery status will cause the Change Notification on the load to be removed.  Proceed with this change?',
                };

                confirmRemovalOfChangeNotification = modalService.showModal({}, modalParams);
            }
            else {
                var deferred = $q.defer();
                deferred.resolve();
                confirmRemovalOfChangeNotification = deferred.promise;
            }

            return confirmRemovalOfChangeNotification.then(function () {
                // note: any id values set here also need to be set in the same way in the saveLoads function in add-edit-job-loads.js
                $scope.load.deliveryStatusId = $scope.load.deliveryStatus.id;
                $scope.load.depotId = $scope.load.depot.id;
                $scope.load.requiredVehicleTypeId = $scope.load.requiredVehicleType ? $scope.load.requiredVehicleType.id : null;

                var cdIsAnyTime = $scope.load.cdIsAnyTime;

                if (!$scope.load.cdDateTime) {
                    $scope.load.cdDateTime = new Date(constants.minimumDateString);
                }

                if (!$scope.load.ddDateTime) {
                    $scope.load.ddDateTime = new Date(constants.minimumDateString);
                }

                $scope.load.cdDateTime.setHours(cdIsAnyTime ? 0 : $scope.cdTimeValue.getHours());
                $scope.load.cdDateTime.setMinutes(cdIsAnyTime ? 0 : $scope.cdTimeValue.getMinutes());
                $scope.load.cdDateTime.setSeconds(0);

                var ddIsAnyTime = $scope.load.ddIsAnyTime;

                if ($scope.load.ddDateTime) {
                    $scope.load.ddDateTime.setHours(ddIsAnyTime ? 0 : $scope.ddTimeValue.getHours());
                    $scope.load.ddDateTime.setMinutes(ddIsAnyTime ? 0 : $scope.ddTimeValue.getMinutes());
                    $scope.load.ddDateTime.setSeconds(0);
                }

                var loadCopy;

                if ($scope.edit) {
                    if ($scope.isSubcontracted) {
                        $scope.load.subcontractor = getSubcontractor();
                        $scope.load.subcontractorContactDetails = getSubcontractorContactDetails();
                    }

                    $scope.loadForm.$setPristine();
                    loadCopy = angular.copy($scope.load);
                    checkForEmptyDates();

                    var result = apiService.job.updateLoad({ id: $scope.jobId }, loadCopy).$promise.then(function (updateResult) {
                        $scope.load.loadStatusId = updateResult.loadStatusId;
                        $scope.load.loadStatus = updateResult.loadStatus;
                        $scope.load.canInvoice = updateResult.canInvoice;
                        $scope.load.hasChangesForNotification = updateResult.hasChangesForNotification;
                    });

                    return result;
                }

                $scope.loadForm.$setPristine();
                loadCopy = angular.copy($scope.load);
                checkForEmptyDates();

                return apiService.job.createLoad({ id: $scope.jobId }, loadCopy).$promise.then(function (createResult) {
                    $scope.load.id = createResult.id;
                    checkForEmptyDates();
                });
            });
        };

        var resetData = function () {
            var promise = loadData().then(function () {
                $scope.loadForm.$setPristine();
            });

            return promise;
        };

        var checkForEmptyDates = function () {
            if ($scope.load.cdDateTime && ($scope.load.cdDateTime.getFullYear() === (new Date(constants.minimumDateString)).getFullYear())) {
                $scope.load.cdDateTime = null;
            }

            if ($scope.load.ddDateTime && ($scope.load.ddDateTime.getFullYear() === (new Date(constants.minimumDateString)).getFullYear())) {
                $scope.load.ddDateTime = null;
            }
        };

        var isUserInRole = function (roleIds) {
            return _.some(user.roles, function (userRole) {
                return _.contains(roleIds, userRole.id);
            });
        };


        //// SCOPE FUNCTIONS ////

        $scope.isDirty = function () {
            return $scope.loadForm !== undefined && $scope.loadForm.$dirty;
        };

        $scope.subcontractText = function () {
            return $scope.isSubcontracted ? 'Bring Load Back In-House' : 'Subcontract Load';
        };

        $scope.subcontractTooltip = function () {
            if ($scope.isSubcontractDisabled()) {
                return ($scope.load.loadStatusId === enums.loadStatus.enquiry) ? 'Load is still an enquiry.' : 'Load has been delivered';
            }

            return '';
        };

        $scope.cdTimeTooltip = function () {
            return 'Time';
        };

        $scope.ddTimeTooltip = function () {
            return 'Time';
        };

        $scope.createDriverInstructionsTooltip = function () {
            if ($scope.load.customerAccountStatusId === enums.accountStatus.onStop) {
                return 'Not available: customer account status is "On Stop"';
            }

            if ($scope.load.customerAccountStatusId === enums.accountStatus.toBeAdvised) {
                return 'Not available: customer account status is "To Be Advised"';
            }

            if ($scope.load.loadStatusId < enums.loadStatus.planned) {
                return 'Not available: This load has not been planned';
            }

            return '';
        };

        $scope.deliveryStatusTooltip = function () {

            if ($scope.loadIsEnquiryOrProvisionalOrNotPlanned) {
                return 'The load has not been planned';
            }

            if ($scope.load.kamComplete) {
                return 'The load has been marked as KAM Complete.';
            }

            if (!$scope.edit) {
                return 'The load has not been saved';
            }

            if (user.id && isUserInRole([enums.roles.systemAdministrator, enums.roles.planner, enums.roles.keyAccountManager])) {
                return 'Delivery Status';
            }

            return 'You do not have permission to edit this field.';
        };

        $scope.subcontractorTooltip = function () {

            return $scope.isSubcontractDisabled() ? 'This load has been delivered' : 'Subcontractor';
        };

        $scope.subcontractorContactDetailsTooltip = function () {
            return $scope.isSubcontractDisabled() ? 'This load has been delivered' : 'Subcontractor Contact Details (Name, Mobile Number)';
        };

        $scope.loadStatusText = function () {
            if (!$scope.load.loadStatus) {
                return '';
            }

            return $scope.load.loadStatus + (($scope.isSubcontracted) ? ' (Subcontracted)' : '');
        };

        $scope.isKamCompleteDisabled = function () {
            return !$scope.canSetKAMComplete || !$scope.loadIsDelivered() || $scope.load.dmComplete;
        };

        $scope.isDmCompleteDisabled = function () {
            return !$scope.canSetDMComplete || !$scope.load.kamComplete || $scope.load.invoiceId !== null;
        };

        $scope.isSubcontractDisabled = function () {
            return $scope.loadIsDelivered() || $scope.load.loadStatusId === enums.loadStatus.enquiry;
        };

        $scope.loadIsDelivered = function () {
            return !$scope.load.deliveryStatus || $scope.load.deliveryStatus.id > enums.deliveryStatus.notDelivered;
        };

        $scope.kamCompleteTooltip = function () {
            if (!$scope.loadIsDelivered()) {
                return 'The load has not been delivered';
            }

            if ($scope.load.dmComplete) {
                return 'The load has been set as DM Complete';
            }

            if (!$scope.canSetKAMComplete) {
                return 'You do not have permission to set KAM Complete';
            }

            return 'KAM Complete';
        };

        $scope.dmCompleteTooltip = function () {
            if (!$scope.load.kamComplete) {
                return 'The load has not been set as KAM Complete';
            }

            if ($scope.load.invoiceId) {
                return 'The load has been invoiced';
            }

            if (!$scope.canSetDMComplete) {
                return 'You do not have permission to set DM Complete';
            }

            return 'DM Complete';
        };

        $scope.ddDateOpened = false;
        $scope.load.ddIsAnyTime = true;

        $scope.openCDDate = function ($event) {
            $event.preventDefault();
            $event.stopPropagation();

            $scope.ddDateOpened = false;
            $scope.cdDateOpened = !$scope.cdDateOpened;
        };

        $scope.$parent.isCreateInvoiceDisabled = function () {
            return !$scope.load || !$scope.load.canInvoice;
        };

        $scope.createInvoiceTooltip = function () {
            if ($scope.load.invoiceId !== null) {
                return 'This load has already been invoiced';
            }

            if ($scope.load.loadStatusId !== enums.loadStatus.readyToInvoice) {
                return 'This load is not ready to invoice';
            }

            return null;
        };

        $scope.createInvoice = function (isPreInvoice, isProformaInvoice) {
            if (!isProformaInvoice && $scope.isCreateInvoiceDisabled()) {
                return;
            }
            if (checkFormValid()) {
                unsavedChangesService.doActionWithChecks(function () {
                    $scope.creatingDocument = true;

                    var createApi = isPreInvoice ? apiService.job.createPreInvoice : isProformaInvoice ? apiService.job.createProformaInvoice : apiService.job.createInvoice;

                    createApi({ id: $scope.jobId }, [$scope.load.id]).$promise.then(function (result) {
                        if (!isPreInvoice && !isProformaInvoice) {
                            $scope.load.invoiceId = result.invoiceId;
                            $scope.load.invoiceDocumentIdentifier = result.invoiceDocumentIdentifier;

                            var resultLoad = _.findWhere(result.loads, { id: $scope.load.id });

                            if (resultLoad !== null) {
                                $scope.load.loadStatusId = resultLoad.loadStatusId;
                                $scope.load.loadStatus = resultLoad.loadStatus;
                            }
                        }

                        $scope.viewInvoice(result.invoiceDocumentIdentifier);
                    })
                    .finally(function () {
                        $scope.creatingDocument = false;
                    });
                });
            }

        };

        $scope.viewInvoice = function (invoiceDocumentIdentifier) {
            var url = $state.href('auth.master.invoice', { documentIdentifier: invoiceDocumentIdentifier });
            $window.open(url, '', 'toolbar=0,menu=0,scrollbars=1');
        };

        $scope.openDDDate = function ($event) {
            $event.preventDefault();
            $event.stopPropagation();

            $scope.cdDateOpened = false;
            $scope.ddDateOpened = !$scope.ddDateOpened;
        };

        $scope.checkDeliveryDateValid = function () {
            $scope.loadForm.ddDate.$setValidity('startDateGreater', true);
            $scope.loadForm.cdDate.$setValidity('startDateGreater', true);

            if ($scope.load.cdDateTime === null || $scope.load.ddDateTime === null) {
                return;
            }

            var colDate = moment($scope.load.cdDateTime).startOf('day');
            var delDate = moment($scope.load.ddDateTime).startOf('day');

            if ($scope.cdTimeValue) {
                colDate.hours($scope.cdTimeValue.getHours()).minutes($scope.cdTimeValue.getMinutes());
            }

            if ($scope.ddTimeValue) {
                delDate.hours($scope.ddTimeValue.getHours()).minutes($scope.ddTimeValue.getMinutes());
            }
            else {
                delDate.add(1, 'days').subtract(1, 'milliseconds');
            }

            if (delDate.isBefore(colDate) && ($scope.load.ddDateTime != undefined)) {
                $scope.loadForm.ddDate.$setValidity('startDateGreater', false);
                $scope.loadForm.cdDate.$setValidity('startDateGreater', false);
            }
        };

        $scope.timePickerOptions = {
            timeFormat: 'H:i'
        };

        $scope.postcodePattern = {
            test: function (value) {
                return postcodeValidation.evaluate(value).valid;
            }
        };

        $scope.save = function () {
            if ($scope.saving) {
                return;
            }

            if (checkFormValid()) {
                $scope.saving = true;
                saveInternal().then(function () {
                    if ($scope.edit) {
                        ngToast.success('The load has been updated.');
                    }
                    else {
                        $state.transitionTo('auth.master.jobs.job.loads.edit', { jobId: $scope.jobId, loadId: $scope.load.id, created: true });
                    }
                }).finally(function () {
                    $scope.saving = false;
                });
            }
        };

        $scope.copyLoad = function () {
            if (checkFormValid()) {
                unsavedChangesService.doActionWithChecks(function () {
                    openCopyLoadModal();
                });
            }
        };

        $scope.subcontract = function () {
            if (checkFormValid()) {
                unsavedChangesService.doActionWithChecks(function () {

                    if (!$scope.isSubcontracted) {
                        openSubcontractModal();
                    }
                    else {
                        apiService.job.bringLoadInHouse({ id: $scope.jobId, loadId: $scope.load.id }, {}).$promise.then(function (load) {
                            $scope.load.loadStatusId = load.loadStatusId;
                            $scope.load.loadStatus = load.loadStatus;
                            $scope.load.subcontractor = null;
                            $scope.load.subcontractorContactDetails = null;
                            $scope.isSubcontracted = false;
                        });
                    }
                    
                });
            }
        };

        $scope.isCreateDriverInstructionsDisabled = function () {
            return !$scope.load || $scope.load.customerAccountStatusId !== enums.accountStatus.active || $scope.load.loadStatusId < enums.loadStatus.planned;
        };

        $scope.createDriverInstructions = function () {
            if ($scope.isCreateDriverInstructionsDisabled()) {
                return;
            }
            
            if (checkFormValid()) {
                unsavedChangesService.doActionWithChecks(function () {
                    $scope.creatingDocument = true;
                    apiService.job.createDriverInstructions({ id: $scope.load.id }, null).$promise
                    .then(function (result) {
                        $scope.load.driverInstructionsIdentifier = result.driverInstructionsIdentifier;
                        $scope.viewDriverInstructions();
                    })
                    .finally(function () {
                        $scope.creatingDocument = false;
                    });
                });
            }
        };

        $scope.viewDriverInstructions = function () {
            var url = $state.href('auth.master.jobs.job.loads.driverInstructions', { loadId: $scope.load.id, documentIdentifier: $scope.load.driverInstructionsIdentifier });
            $window.open(url, '', 'toolbar=0, menu=0, scrollbars=1');
        };

        $scope.addGoodsItem = function () {
            addEditGoodsItem();
        };

        $scope.editGoodsItem = function (goodsItem) {
            addEditGoodsItem(goodsItem);
        };

        $scope.deleteGoodsItem = function (goodsItem) {
            if (checkFormValid()) {
                apiService.job.deleteGoodsItem({ jobId: $scope.jobId, loadId: $scope.load.id, goodsItemId: goodsItem.id }).$promise.then(function () {
                    var index = $scope.load.goodsItems.indexOf(goodsItem);
                    return index >= 0 ? $scope.load.goodsItems.splice(index, 1) : $scope.load.goodsItems;
                });
            }
        };

        $scope.setCollectionAddress = function (companyAddress) {
            if (companyAddress) {
                $scope.load.cdAddress.addressLines = companyAddress.address.addressLines;
                $scope.load.cdAddress.postTown = companyAddress.address.postTown;
                $scope.load.cdAddress.county = companyAddress.address.county;
                $scope.load.cdAddress.postcode = companyAddress.address.postcode;
                $scope.load.cdCompanyName = companyAddress.name;
            }

        };

        $scope.setCountry = function (country) {
            if (country) {
                $scope.load.cdAddress.country = [{ name: 'US' }];
            }
        };

        $scope.setDeliveryAddress = function (companyAddress) {
            if (companyAddress) {
                $scope.load.ddAddress.addressLines = companyAddress.address.addressLines;
                $scope.load.ddAddress.postTown = companyAddress.address.postTown;
                $scope.load.ddAddress.county = companyAddress.address.county;
                $scope.load.ddAddress.postcode = companyAddress.address.postcode;
                $scope.load.ddCompanyName = companyAddress.name;
            }
        };

        $scope.checkDepotDisabled = function () {
            $scope.depotDisabledTooltip = 'Covered By';
            $scope.isDepotDisabled = false;

            if ($scope.load.loadStatusId > enums.loadStatus.pending) {
                $scope.depotDisabledTooltip = 'The load has been planned';
                $scope.isDepotDisabled = true;
            }
            else if (user.id === undefined) {
                $scope.isDepotDisabled = true;
            }
            else if ($scope.load.depot !== undefined && user.depot.id !== $scope.load.depot.id && !isUserInRole([enums.roles.systemAdministrator])) {
                $scope.depotDisabledTooltip = 'The load has been assigned to a depot that is not your home depot.';
                $scope.isDepotDisabled = true;
            }
        };

        $scope.isDeliveryStatusDisabled = function () {
            if ($scope.loadIsEnquiryOrProvisionalOrNotPlanned || $scope.load.kamComplete || !$scope.edit) {
                return true;
            }

            if (user.id) {
                if (isUserInRole([enums.roles.systemAdministrator, enums.roles.planner, enums.roles.keyAccountManager])) {
                    return false;
                }
            }

            return true;
        };

        $scope.goToLoad = function (loadId) {
            if (!loadId) {
                return;
            }

            $state.transitionTo('auth.master.jobs.job.loads.edit', { jobId: $scope.jobId, loadId: loadId });

        };

        //// WATCHES ////

        $scope.$watch('cdTimeValue', function (newValue, oldValue) {
            if (newValue !== undefined) {
                $scope.load.cdIsAnyTime = newValue === '';
            }

            $scope.checkDeliveryDateValid();
        });

        $scope.$watch('ddTimeValue', function (newValue, oldValue) {
            if (newValue !== undefined) {
                $scope.load.ddIsAnyTime = newValue === '';
            }

            $scope.checkDeliveryDateValid();
        });

        $scope.$watch('load.ddDateTime', function (newValue, oldValue) {
            $scope.checkDeliveryDateValid();
        });

        $scope.$watch('load.cdDateTime', function (newValue, oldValue) {
            $scope.checkDeliveryDateValid();
        });

        $scope.$watch('load.loadStatusId', function (newValue, oldValue) {
            $scope.checkDepotDisabled();
            $scope.loadIsEnquiryOrProvisionalOrNotPlanned = $scope.load.jobStatusId < enums.jobStatus.planned && $scope.load.loadStatusId < enums.loadStatus.planned;
        });
        
        $scope.$watch('load.subcontractor', function (newValue, oldValue) {
            if (oldValue !== undefined && oldValue !== null) {
                $scope.load.subcontractorContactDetails = null;
            }

            if ($scope.load.subcontractor && typeof ($scope.load.subcontractor) === 'object' && $scope.load.subcontractor.id) {
                $scope.subcontractorContactDetails = _.where($scope.allSubcontractorContactDetails, { subcontractorId: $scope.load.subcontractor.id });
            }
            else {
                $scope.subcontractorContactDetails = [];
            }

        });

        $scope.$watch($scope.isDirty, function (dirty) {
            $scope.master.isDirty = dirty;
        });


        //// PAGE SETUP ////

        loadData();
        loadPermissions();

        unsavedChangesService.register(saveInternal, $scope.isDirty, ($scope.edit ? resetData : null));

    }
]);
