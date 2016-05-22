//From stack overflow : http://stackoverflow.com/a/32967199
'use strict';
angular.module('dwtApp')
    .directive('typeahead', function () {
        return {
            restrict: 'A',
            priority: 1000, // Let's ensure AngularUI Typeahead directive gets initialized first!
            link: function (scope, element, attrs) {
                // Bind keyboard events
                var keyCode = { arrowUp: 38, arrowDown: 40 };
                element.bind('keydown', function (evt) {
                    if (evt.which === keyCode.arrowUp || evt.which === keyCode.arrowDown) {
                        // Broadcast a possible change of the currently active option:
                        // (Note that we could pass the activeIdx value as event data but AngularUI Typeahead directive
                        //  has its own local scope which makes it hard to retrieve, see:
                        //  https://github.com/angular-ui/bootstrap/blob/7b7039b4d94074987fa405ee1174cfe7f561320e/src/typeahead/typeahead.js#L104)
                        scope.$broadcast('TypeaheadActiveChanged');
                    }
                });
            }
        };
    }).directive('typeaheadPopup', function () {
        return {
            restrict: 'EA',
            link: function (scope, element, attrs) {
                var unregisterFn = scope.$on('TypeaheadActiveChanged', function (event, data) {
                    if (scope.activeIdx >= 0) {
                        // Retrieve active Typeahead option:
                        var option = element.find('#' + attrs.id + '-option-' + scope.activeIdx);
                        if (option.length) {
                            // Make sure option is visible:
                            option[0].scrollIntoView(false);
                        }
                    }
                });

                // Ensure listener is unregistered when $destroy event is fired:
                scope.$on('$destroy', unregisterFn);
            }
        };
    });
