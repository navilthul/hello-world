'use strict';

angular.module('dwtApp').directive('typeaheadDropdown', ['$compile', function ($compile) {

    var linkFn = function (scope, element, attrs, ngModel) {

        var template =
            '<div class="typeahead-dropdown">' +
            '  <div class="dropdown" dropdown keyboard-nav is-open="dropdownState.open">' +
            '    <div class="input-group">' +
            '      <span class="input-group-btn">' +
            '         <div class="btn btn-default dropdown-toggle" dropdown-toggle ng-disabled="tdDisabled">' +
            '            <span class="caret"></span>' +
            '         </div>' +
            '      </span>' +
            '    </div>' +
            '    <ul ng-if="tdOptions.length" class="dropdown-menu dropdown-select" role="menu" style="max-height: 220px; overflow-y: auto;">' +
            '      <li ng-repeat="op in tdOptions">' +
            '        <a href ng-click="onSelect(op)">{{generateRowText(op)}}</a>' +
            '      </li>' +
            '    </ul>' +
            '  </div>' +
            '</div>';

        var templateElem = angular.element(template);
        $compile(templateElem)(scope);

        var currentParent = element.parent();
        element.detach();

        templateElem.find('.input-group').prepend(element);

        currentParent.prepend(templateElem);

        scope.dropdownState = { open: false };

        // Up and Down arrow keys should trigger drop-down, but not if the typeahead is expanded
        element.on('keydown', function (evt) {
            var keyCode = { arrowUp: 38, arrowDown: 40 };

            if (scope.dropdownState.open) {
                if (evt.which !== keyCode.arrowUp && evt.which !== keyCode.arrowDown) {
                    scope.$evalAsync(function () {
                        scope.dropdownState.open = false;
                    });
                }
            }
            else if (!scope.tdDisabled && (evt.which === keyCode.arrowUp || evt.which === keyCode.arrowDown)) {
                var typeaheadList = angular.element('#' + element.attr('aria-owns'));

                if (typeaheadList.css('display') !== 'block') {
                    scope.$evalAsync(function () {
                        scope.dropdownState.open = true;
                    });
                }
            }
        });

        scope.onSelect = function ($item) {
            if (scope.tdOnSelect) {
                scope.tdOnSelect($item);
            }
            else {
                scope.tdModel = $item;
                ngModel.$setDirty();
            }

            element.focus();
        };

        scope.generateRowText = function (option) {
            if (!scope.tdViewField) {
                return option;
            }
            else if (option[scope.tdViewField].constructor === Array) {
                var rowText = '';
                for (var i = 0; i < option[scope.tdViewField].length; i++) {
                    if (i < option[scope.tdViewField].length - 1) {
                        rowText += option[scope.tdViewField][i] + ' - ';
                    }
                    else {
                        rowText += option[scope.tdViewField][i];
                    }
                }

                return rowText;
            }

            return option[scope.tdViewField];
        };

    };

    return {
        restrict: 'A',
        scope: {
            tdOptions: '=typeaheadDropdown',
            tdViewField: '@?typeaheadDropdownViewField',
            tdModel: '=ngModel',
            tdDisabled: '=typeaheadDropdownDisabled',
            tdOnSelect: '=typeaheadDropdownOnSelect',
        },
        require: 'ngModel',
        priority: 10,
        link: linkFn,
    };
}]);
