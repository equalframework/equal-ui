import {MDCFormField} from '@material/form-field';
import {MDCRipple} from '@material/ripple';
import {MDCCheckbox} from '@material/checkbox';
import {MDCTextField} from '@material/textfield';
import {MDCDataTable} from '@material/data-table';
import {MDCSelect} from '@material/select';
import {MDCMenu, DefaultFocusState} from '@material/menu';
import {MDCList} from '@material/list';
import {MDCTabBar} from '@material/tab-bar';
import {MDCSnackbar} from '@material/snackbar';
import {MDCSwitch} from '@material/switch';
import {MDCDialog} from '@material/dialog';
import {MDCTooltip} from '@material/tooltip';

import { $ } from "./jquery-lib";

class UIHelper {

    public static getUUID() {
        var S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        // generate a random guid
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }

/*
 Helpers for element creation
*/
    public static createButton(id:string, label:string, type:string = '', icon:string = '', variant='')  {
        let $button = $('<button/>').attr('id', id);

        if(['outlined', 'raised', 'text'].indexOf(type) >= 0) {
            $button.addClass('mdc-button mdc-button--touch')
            .append($('<span/>').addClass('mdc-button__ripple'));

            if(icon.length) {
                $button.append($('<i/>').addClass('material-icons mdc-button__icon').text(icon))
            }
            $button.append($('<span/>').attr('for', id).addClass('mdc-button__label').text(label));

            switch(type) {
                case 'outlined':
                    $button.addClass('mdc-button--outlined');
                    break;
                case 'raised':
                    $button.addClass('mdc-button--raised');
                    break;
                case 'text':
                default:
            }
        }
        else if(['fab', 'mini-fab'].indexOf(type) >= 0) {
            $button.addClass('mdc-fab')
            .append($('<div/>').addClass('mdc-fab__ripple'));
            if(type == 'mini-fab') {
                $button.addClass('mdc-fab--mini');
            }
            else {
                $button.addClass('mdc-fab--touch');
            }
            $button.append($('<span/>').addClass('material-icons mdc-fab__icon').text(icon))
            $button.append($('<div/>').addClass('mdc-fab__touch'));
        }
        else if(['icon'].indexOf(type) >= 0) {
            $button.addClass('mdc-icon-button').attr('aria-describedby', id+'-tooltip').attr('data-tooltip-id', id+'-tooltip')
            .append($('<span/>').addClass('material-icons mdc-icon-button__icon').text(icon))
            // #todo - fix ripple not working on icon-button

            // workaround to fix tooltips not hiding
            $button.on( "mouseenter", () => {
                $button.parent().find('#'+id+'-tooltip').removeClass('mdc-tooltip--hide');
            });
            $button.on( "mouseleave", () => {
                $button.parent().find('#'+id+'-tooltip').addClass('mdc-tooltip--hide');
            });
        }

        switch(variant) {
            case 'primary':
                $button.addClass('mdc-button--primary');
                break;
            case 'secondary':
                $button.addClass('mdc-button--secondary');
                break;
            default:
        }

        new MDCRipple($button[0]);
        return $button;
    }

    public static createSplitButton(id:string, label:string, variant='') {
        let $elem = $('<div style="display: inline-flex;"></div>');

        let $button = this.createButton(id+'_button', label, 'raised', '', variant).addClass('mdc-button-split_button');
        let $drop_button = this.createButton(id+'_drop', '', 'raised', 'arrow_drop_down', variant).addClass('mdc-button-split_drop');

        let $drop_menu = this.createMenu(id+'_drop'+'menu').appendTo($drop_button);
        let $menu_list = this.createList(id+'_drop'+'menu-list').addClass('menu-list').appendTo($drop_menu);

        this.decorateMenu($drop_menu);

        $drop_button.css({'right': 0});

        $drop_button.on('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            let parent_width = <number> Math.round(<number>$button.innerWidth()) + Math.round(<number>$drop_button.innerWidth());
            if(parent_width > <number> $drop_menu.innerWidth()) {
                $drop_menu.css({'width': parent_width+'px'})
            }
            else {
                $drop_menu.css({'left': '-'+(Math.round(<number>$button.innerWidth()))+ 'px'})
            }
            $drop_menu.trigger('_toggle')
            return false;
        });

        return $elem.append($button).append($drop_button);
    }

    public static createTooltip(id:string, label: string) {
        let $elem = $('<div/>').attr('id', id+'-tooltip').addClass('mdc-tooltip').attr('role', 'tooltip').attr('aria-hidden', 'true')
        .append($('<div/>').addClass('mdc-tooltip__surface').text(label));
        return $elem;
    }

    public static createIcon(icon: string) {
        let $elem = $('<span class="material-icons">'+icon+'</span>');
        return $elem;
    }

    public static createSwitch(id:string, label:string, value:boolean, helper:string = '', icon: string = '', disabled: boolean = false) {
        let $elem = $('\
        <div id="'+id+'"> \
            <div class="sb-ui-switch" > \
                <div class="mdc-switch '+ ((disabled)?'mdc-switch--disabled':'') + '"> \
                    <div class="mdc-switch__track"></div> \
                    <div class="mdc-switch__thumb-underlay"> \
                        <div class="mdc-switch__thumb"></div> \
                        <input type="checkbox" class="mdc-switch__native-control" role="switch" '+ ((value)?'checked':'') + ' ' + ((disabled)?'disabled':'') +'> \
                    </div> \
                </div> \
                <label for="basic-switch">'+label+'</label> \
            </div> \
            <div class="mdc-text-field-helper-line"> \
                <div class="mdc-text-field-helper-text" aria-hidden="true" title="'+helper+'">'+helper+'</div> \
            </div> \
        </div>');
        new MDCSwitch($elem.find('.mdc-switch')[0]);
        return $elem;
    }

    /**
     *
     * @param type  'filled' (default) or 'outlined'
     */
    public static createInput(id:string, label:string, value:string, helper:string = '', icon: string = '', disabled: boolean = false, type: string = 'filled', trailing_icon: string ='') {
        let $elem = $('\
        <div id="'+id+'"> \
            <label class="mdc-text-field mdc-text-field--'+type+' mdc-text-field--with-trailing-icon"> \
                <span class="mdc-text-field__ripple"></span> \
                <span class="mdc-floating-label">'+label+'</span> \
                '+((icon.length)?'<i aria-hidden="true" class="material-icons mdc-text-field__icon">'+icon+'</i>':'')+'\
                <input id="'+id+'_input" '+( (disabled)?'disabled':'' )+' class="mdc-text-field__input" type="text" role="presentation" autocorrect="off" autocomplete="off" spellcheck="false" value="'+value+'"> \
                '+((trailing_icon.length)?'<i class="material-icons mdc-text-field__icon mdc-text-field__icon--trailing" tabindex="0" role="button">'+trailing_icon+'</i>':'')+'\
                <span class="mdc-line-ripple"></span> \
            </label> \
            <div class="mdc-text-field-helper-line"> \
                <div class="mdc-text-field-helper-text" aria-hidden="true" title="'+helper+'">'+helper+'</div> \
            </div> \
        </div>');

        let text = new MDCTextField($elem[0]);
        $elem.find('input').on('change', () => {
            // sync MDC object and input
            text.value = <string> $elem.find('input').val();
        });
        return $elem;
    }

    public static createTextArea(id:string, label:string, value:string, helper:string = '', icon: string = '', disabled: boolean = false) {
        let $elem = $('\
        <div> \
            <label class="mdc-text-field mdc-text-field--filled mdc-text-field--textarea mdc-text-field--with-internal-counter"> \
                <span class="mdc-text-field__ripple"></span> \
                <span class="mdc-floating-label" id="my-label-id">'+label+'</span> \
                <span class="mdc-text-field__resizer"> \
                    <textarea '+( (disabled)?'disabled':'' )+' class="mdc-text-field__input" rows="8" cols="40" maxlength="255" aria-label="Label">'+value+'</textarea> \
                </span> \
                <span class="mdc-line-ripple"></span> \
            </label> \
            <div class="mdc-text-field-helper-line"> \
              <div class="mdc-text-field-helper-text" aria-hidden="true" title="'+helper+'">'+helper+'</div> \
              <div class="mdc-text-field-character-counter">0 / 255</div> \
          </div> \
        </div>');


        new MDCTextField($elem[0]);
        return $elem;
    }

    public static createInputView(id:string, label:string, value:string, helper:string) {
        let $elem = $('\
        <div> \
        <label class="mdc-text-field mdc-text-field--filled"> \
            <span class="mdc-floating-label">'+label+'</span> \
            <input disabled class="mdc-text-field__input" type="text" value="'+value+'"> \
            <span class="mdc-line-ripple"></span>\
        </label> \
        <div class="mdc-text-field-helper-line"> \
            <div class="mdc-text-field-helper-text" aria-hidden="true" title="'+helper+'">'+helper+'</div> \
        </div> \
        </div>');
        new MDCTextField($elem[0]);
        return $elem;
    }

    public static createCheckbox(id:string, label:string) {
        let $elem = $('\
        <div class="mdc-form-field"> \
            <div class="mdc-checkbox"> \
                <input type="checkbox" class="mdc-checkbox__native-control" id="'+id+'"/> \
                <div class="mdc-checkbox__background"> \
                    <svg class="mdc-checkbox__checkmark" viewBox="0 0 24 24"> \
                        <path class="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59"/> \
                    </svg> \
                    <div class="mdc-checkbox__mixedmark"></div> \
                </div> \
                <div class="mdc-checkbox__ripple"></div> \
            </div> \
            <label for="'+id+'">'+label+'</label> \
        </div>');

        return $elem;
    }

    public static createListItem(id: string, label: string, icon:string = '') {
        let $elem = $('\
        <li class="mdc-list-item" tabindex="-1" id="'+id+'"> \
            <span class="mdc-list-item__text">'+label+'</span> \
            <span class="mdc-list-item__ripple"></span> \
        </li>');

        if(icon.length) {
            $elem.prepend($('<span/>').addClass('mdc-list-item__graphic material-icons').text(icon));
        }

        new MDCRipple($elem[0]);
        return $elem;
    }

    public static createListDivider() {
        return $('<li role="separator" class="mdc-list-divider"></li>');
    }


    public static createListItemCheckbox(id: string, label: string) {
        let $elem = $('\
        <li class="mdc-list-item"> \
            <div class="mdc-touch-target-wrapper"> \
                <div class="mdc-checkbox mdc-checkbox--touch"> \
                    <input type="checkbox" class="mdc-checkbox__native-control" id="'+id+'"/> \
                    <div class="mdc-checkbox__background"> \
                        <svg class="mdc-checkbox__checkmark" viewBox="0 0 24 24"> \
                            <path class="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59"/> \
                        </svg> \
                        <div class="mdc-checkbox__mixedmark"></div> \
                    </div> \
                    <div class="mdc-checkbox__ripple"></div> \
                </div> \
            </div> \
            <span class="mdc-list-item__ripple"></span> \
            <span class="mdc-list-item__text">'+label+'</span> \
        </li>');

        new MDCRipple($elem[0]);
        return $elem;
    }

    public static createTableCellCheckbox(is_header:boolean = false) {
        let elem = (is_header)?'th':'td';
        let suffix = (is_header)?'header-':'';
        let $elem = $('\
        <'+elem+' class="mdc-data-table__'+suffix+'cell mdc-data-table__'+suffix+'cell--checkbox"> \
            <div class="sb-ui-checkbox mdc-checkbox mdc-data-table__'+suffix+'row-checkbox"> \
                <input type="checkbox" class ="mdc-checkbox__native-control" /> \
                <div class="mdc-checkbox__background"> \
                    <svg class="mdc-checkbox__checkmark" viewBox="0 0 24 24"><path class="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59" /></svg> \
                <div class="mdc-checkbox__mixedmark"></div> \
            </div> \
            <div class="mdc-checkbox__ripple"></div> \
        </'+elem+'> \
        ');

        new MDCRipple($elem[0]);
        return $elem;
    }

    public static createChip(label: string) {
        let $elem = $(' \
        <div class="mdc-chip" role="row"> \
            <div class="mdc-chip__ripple"></div> \
            <span role="gridcell"> \
                <span role="button" tabindex="0" class="mdc-chip__primary-action"> \
                <span class="mdc-chip__text">'+label+'</span> \
                </span> \
            </span> \
            <span role="gridcell"> \
                <i class="material-icons mdc-chip__icon mdc-chip__icon--trailing" tabindex="-1" role="button">cancel</i> \
            </span> \
        </div>');
        return $elem;
    }

    public static createSnackbar(label: string, action: string = '', link: string = '', timeout: number = 4000) {
        let elem = ' \
        <div class="mdc-snackbar"> \
            <div class="mdc-snackbar__surface" role="status" aria-relevant="additions"> \
                <div class="mdc-snackbar__label" aria-atomic="false"> \
                '+label+' \
                </div> \
                <div class="mdc-snackbar__actions" aria-atomic="true">';
        if(action.length) {
            elem += '\
                    <button type="button" class="mdc-button mdc-snackbar__action"> \
                        <div class="mdc-button__ripple"></div> \
                        <span class="mdc-button__label">'+action+'</span> \
                    </button>';
        }
        elem += '\
                    <button class="mdc-icon-button mdc-snackbar__dismiss material-icons" title="Dismiss">close</button> \
                </div> \
            </div> \
        </div>';
        let $elem = $(elem);
        let snackbar = new MDCSnackbar($elem[0]);
        snackbar.timeoutMs = timeout;
        snackbar.open();
        return $elem;
    }

    public static createSelect(id: string, label: string, values: any, selected: any='', helper:string = '', disabled: boolean=false) {
        let $elem = $('\
        <div id="'+id+'" class="mdc-select mdc-select--filled '+( (label.length)?'':'mdc-select--no-label' )+' '+ ( (disabled)?'mdc-select--disabled':'' ) +'"> \
            <div class="mdc-select__anchor" role="button" tabindex="0"> \
                <span class="mdc-select__ripple"></span> \
                '+ ( (label.length)?'<span class="mdc-floating-label">'+label+'</span>':'' ) +'\
                <span class="mdc-select__selected-text-container"> \
                    <span class="mdc-select__selected-text">'+selected+'</span> \
                </span> \
                <span class="mdc-select__dropdown-icon"> \
                    <svg class="mdc-select__dropdown-icon-graphic" viewBox="7 10 10 5"> \
                        <polygon class="mdc-select__dropdown-icon-inactive" stroke="none" fill-rule="evenodd" points="7 10 12 15 17 10"></polygon> \
                        <polygon class="mdc-select__dropdown-icon-active" stroke="none" fill-rule="evenodd" points="7 15 12 10 17 15"></polygon> \
                    </svg> \
                </span> \
                <span class="mdc-line-ripple"></span> \
            </div> \
            <div id="'+id+'_menu" tabindex="-1" class="mdc-select__menu mdc-menu mdc-menu-surface--fixed mdc-menu-surface" role="listbox"> \
                <input id="'+id+'_input" type="text" style="display: none" value="'+selected+'" /> \
                <ul id="'+id+'_menu_list" class="mdc-list"></ul> \
            </div> \
            <div class="mdc-text-field-helper-line"> \
                <div class="mdc-text-field-helper-text" aria-hidden="true" title="'+helper+'">'+helper+'</div> \
            </div> \
        </div>');

        let $list = $elem.find('ul.mdc-list');
        // we recevied an object as param (map)
        if( !Array.isArray(values) ) {
            for(let key in values) {
                let $line = $(' \
                <li id="'+id+'_menu_list-'+key+'" class="mdc-list-item" role="option" data-value="'+key+'"> \
                    <span class="mdc-list-item__ripple"></span> \
                    <span class="mdc-list-item__text">'+values[key]+'</span> \
                </li>');
                if(key == selected) {
                    $line.addClass('mdc-list-item--selected').attr('aria-selected', 'true');
                }
                $list.append($line);
            }
        }
        // we received an array
        else {
            for(let value of values) {
                let $line = $(' \
                <li class="mdc-list-item" tabindex="-1" role="option" data-value="'+value+'"> \
                    <span class="mdc-list-item__ripple"></span> \
                    <span class="mdc-list-item__text">'+value+'</span> \
                </li>');
                if(value == selected) {
                    $line.addClass('mdc-list-item--selected').attr('aria-selected', 'true');
                }
                $list.append($line);
            }
        }

        const select = new MDCSelect($elem[0]);

        // make the element behave like an `input` element
        select.listen('MDCSelect:change', () => {
            $elem.find('input').val(select.value).trigger('change');
        });

        $elem.on('select', (event: any, value: string) => {
            select.value = value;
        });

        // workaround for --fixed style width (mandatory to display list above inputs as sub-items)
        $elem.on('click', () => {
            $elem.find('.mdc-menu-surface').width(<number>$elem.width());
        });

        return $elem;
    }

    public static createList(id:string, label:string='', values:any=[]) {
        let $elem = $('<ul id="'+id+'" tabindex="-1" role="menu" class="mdc-list"></ul>');

        return $elem;
    }

    public static createMenu(id:string, label:string='', values:any=[]) {
        let $elem = $('<div id="'+id+'" tabindex="-1" class="sb-ui-menu mdc-menu mdc-menu-surface mdc-menu-surface--fixed"></div>');
        return $elem;
    }


    public static createTabBar(id:string, label:string, value:string) {
        let $elem = $('\
        <div id="'+id+'" class="mdc-tab-bar" role="tablist"> \
            <div class="mdc-tab-scroller"> \
            <div class="mdc-tab-scroller__scroll-area"> \
                <div class="sb-view-form-sections mdc-tab-scroller__scroll-content"> \
                </div> \
            </div> \
            </div> \
        </div>');

        return $elem
    }

    public static createTabButton(id:string, label:string, active:boolean) {
        let $elem = $('\
        <button id="'+id+'" class="mdc-tab '+((active)?'mdc-tab--active':'')+'" role="tab" tabindex="0"> \
            <span class="mdc-tab__content"> \
                <span class="mdc-tab__text-label">'+label+'</span> \
            </span> \
            <span class="mdc-tab-indicator '+((active)?'mdc-tab-indicator--active':'')+'"> \
                <span class="mdc-tab-indicator__content mdc-tab-indicator__content--underline"></span> \
            </span> \
            <span class="mdc-tab__ripple"></span> \
        </button>');

        return $elem
    }

    public static createPagination() {
        let $elem = $(' \
        <div class="mdc-data-table__pagination"> \
            <div class="pagination-container mdc-data-table__pagination-trailing"> \
                <div class="pagination-rows-per-page mdc-data-table__pagination-rows-per-page"></div> \
                <div class="pagination-navigation mdc-data-table__pagination-navigation"> \
                    <div class="pagination-total mdc-data-table__pagination-total"></div> \
                </div> \
            </div> \
        </div>');
        return $elem;
    }


    public static createPaginationSelect(id: string, label: string, values: any, selected: any='') {
        let $elem  = UIHelper.createSelect(id, label, values, selected);
        $elem.addClass('mdc-data-table__pagination-rows-per-page-select');
        return $elem;
    }


    public static createDialog(id: string, title: string, label_accept:string='Ok', label_cancel:string='Cancel') {
        let $elem = $('\
        <div class="mdc-dialog" id="'+id+'"> \
            <div class="mdc-dialog__container"> \
                <div class="mdc-dialog__surface" role="alertdialog" aria-modal="true" style="overflow: hidden"> \
                    <h2 class="mdc-dialog__title">'+title+'</h2> \
                    <div class="mdc-dialog__content"></div> \
                    <div class="mdc-dialog__actions"> \
                        <button tabindex="0" type="button" class="mdc-button mdc-dialog__button" data-mdc-dialog-action="cancel"> \
                            <div class="mdc-button__ripple"></div> \
                            <span class="mdc-button__label">'+label_cancel+'</span> \
                        </button> \
                        <button tabindex="0" type="button" class="mdc-button mdc-dialog__button" data-mdc-dialog-action="accept"> \
                            <div class="mdc-button__ripple"></div> \
                            <span class="mdc-button__label">'+label_accept+'</span> \
                        </button> \
                    </div> \
                </div> \
            </div> \
            <div class="mdc-dialog__scrim"></div> \
        </div');

        const dialog = new MDCDialog($elem[0]);

        dialog.listen('MDCDialog:opened', () => {
            dialog.layout();
            $elem.find('button[tabindex=0]').focus();
        });

        dialog.listen('MDCDialog:closed', (event:any) => {
            if(event.detail.action == 'accept') {
                $elem.trigger('_accept');
            }
            if(event.detail.action == 'reject') {
                $elem.trigger('_reject');
            }
        });


        $elem.on('_open', () => {
            dialog.open();
        });

        return $elem;
    }



 /*
  Decorators
  Some widgets need to be injected in DOM document before running MDC methods on them.
 */

    public static decorateMenu($elem:any) {
        if(!$elem.length) return;
        let fields_toggle_menu = new MDCMenu($elem[0]);
        // prevent menu from getting the focus
        fields_toggle_menu.setDefaultFocusState(DefaultFocusState.NONE);

        $elem.on('_toggle', () => {
            fields_toggle_menu.open = !$elem.hasClass('mdc-menu-surface--open');
        });

        $elem.on('_open', (event: any) => {
            console.log('MDCMenu _open');
            event.stopPropagation();
            if(!fields_toggle_menu.open) {
                fields_toggle_menu.open = true;
                fields_toggle_menu.selectedIndex = 0;
                // prevent tab capture
                $elem.find('.mdc-list-item').attr('tabindex', -1);
            }
        });

        $elem.on('_close', (event: any) => {
            console.log('MDCMenu _close');
            event.stopPropagation();
            fields_toggle_menu.open = false;
        });

        $elem.on('_moveup', (event:any) => {
            event.stopPropagation();
            let index:number = <number> fields_toggle_menu.selectedIndex;
            fields_toggle_menu.selectedIndex = (index > 0)?index-1:0;
            // prevent tab capture
            $elem.find('.mdc-list-item').attr('tabindex', -1);
        });

        $elem.on('_movedown', (event:any) => {
            event.stopPropagation();
            let index:number = <number> fields_toggle_menu.selectedIndex;
            fields_toggle_menu.selectedIndex = index + 1;
            // prevent tab capture
            $elem.find('.mdc-list-item').attr('tabindex', -1);
        });

        $elem.on('_select', (event:any) => {
            event.stopPropagation();
            $elem.find('.mdc-list-item--selected').trigger('click');
        });

    }

    public static decorateTabBar($elem:any) {
        if(!$elem.length) return;
        new MDCTabBar($elem[0]);
    }

    public static decorateTooltip($elem:any) {
        if(!$elem.length) return;
        new MDCTooltip($elem[0]);
    }

    public static decorateTable($elem:any) {
        if(!$elem.length) return;
        $elem.addClass('mdc-data-table').children().first().addClass('mdc-data-table__table-container');

        let $thead = $elem.find('thead');
        let $table = $elem.find('table').addClass('mdc-data-table__table');
        let $tbody = $table.find('tbody').addClass('mdc-data-table__content');

        $thead.find('th').addClass('mdc-data-table__header-cell');
        $tbody.find('td').addClass('mdc-data-table__cell');

        /*
         handler for click on header checkbox
        */
        $thead.find('th:first-child')
        .find('input[type="checkbox"]:not([data-decorated])')
        .attr('data-decorated', '1')
        .on('change', (event:any) => {
            let $this = $(event.currentTarget);
            // tbody might
            let $tbody = $table.find('tbody');
            if($this.prop('checked')) {
                $tbody.find('td:first-child').find('input[type="checkbox"]').prop('checked', true).prop('indeterminate', false);
                $tbody.find('tbody').find('tr').addClass('mdc-data-table__row--selected');
            }
            else {
                $tbody.find('td:first-child').find('input[type="checkbox"]').prop('checked', false).prop('indeterminate', false);
                $tbody.find('tr').removeClass('mdc-data-table__row--selected');
            }
        })
        .on('refresh', (event:any) => {
            let $tbody = $table.find('tbody');

            let rows_count = $tbody.find('tr').length;
            let selection_count = 0;
            $('td:first-child', $tbody).each( (i:number, elem:any) => {
                selection_count += +$('input[type="checkbox"]', elem).prop('checked');
            });
            if(selection_count == rows_count && rows_count) {
                $thead.find('th:first-child').find('input').prop("indeterminate", false).prop("checked", true);
            }
            else if(selection_count) {
                $thead.find('th:first-child').find('input').prop("indeterminate", true).prop("checked", false);
            }
            else {
                $thead.find('th:first-child').find('input').prop("indeterminate", false).prop("checked", false);
            }
        });

        /*
         handler for click on rows checkboxes
        */
        $tbody.find('td:first-child')
        .find('input[type="checkbox"]:not([data-decorated]')
        .attr('data-decorated', '1')
        .on('change', (event:any) => {
            let $this = $(event.currentTarget);
            let $tbody = $table.find('tbody');

            let rows_count = $tbody.find('tr').length;
            let selection_count = 0;
            $('td:first-child', $tbody).each( (i:number, elem:any) => {
                selection_count += +$('input[type="checkbox"]', elem).prop('checked');
            });

            if($this.prop('checked')) {
                $tbody.find('tbody').find('tr').addClass('mdc-data-table__row--selected');
                // all checkboxes checked ?
                if(selection_count == rows_count) {
                    $thead.find('th:first-child').find('input').prop("indeterminate", false).prop("checked", true);
                }
                else {
                    $thead.find('th:first-child').find('input').prop("indeterminate", true).prop("checked", false);
                }
            }
            else {
                $this.closest('tr').removeClass('mdc-data-table__row--selected');
                // none of the checkboxes checked ?
                if(selection_count == 0) {
                    $thead.find('th:first-child').find('input').prop("indeterminate", false).prop("checked", false);
                }
                else {
                    $thead.find('th:first-child').find('input').prop("indeterminate", true).prop("checked", false);
                }
            }
            return true;
        });

        /*
         handlers for column sorting
        */
        $thead.find('th:not([data-decorated]')
        .attr('data-decorated', '1')
        .hover(
            (event:any) => {
                // set hover and sort order indicator
                let $this = $(event.currentTarget);
                $this.addClass('hover');
                if($this.hasClass('sortable')) {
                    if($this.hasClass('sorted')) {
                        if($this.hasClass('asc')) {
                            $this.removeClass('asc').addClass('desc');
                        }
                        else {
                            $this.removeClass('desc').addClass('asc');
                        }
                    }
                    else {
                        $this.addClass('asc');
                    }
                }
            },
            (event:any) => {
                // unset hover and sort order indicator
                let $this = $(event.currentTarget);
                $this.removeClass('hover');
                if($this.hasClass('sortable')) {
                    if($this.hasClass('sorted')) {
                        if($this.hasClass('asc')) {
                            $this.removeClass('asc').addClass('desc');
                        }
                        else {
                            $this.removeClass('desc').addClass('asc');
                        }
                    }
                    else {
                        $this.removeClass('asc');
                    }
                }
            }
        )
        .on('click',
            (event:any) => {
                let $this = $(event.currentTarget);
                // change sortname and/or sortorder
                if($this.hasClass('sortable')) {
                    // set order according to column field
                    if(!$this.hasClass('sorted')) {
                        let sort = ( (<string>$this.attr('data-sort')).length )?<string>$this.attr('data-sort'):'asc';
                        $this.removeClass('sorted').removeClass('asc').removeClass('desc');
                        $this.addClass('sorted').addClass(sort);
                        $this.attr('data-sort', sort);
                    }
                    // toggle sorting order
                    else {
                        let sort:string = <string>$this.attr('data-sort');
                        if(sort == 'asc') {
                            $this.removeClass('asc').addClass('desc');
                            sort = 'desc';
                        }
                        else {
                            $this.removeClass('desc').addClass('asc');
                            sort = 'asc';
                        }
                        $this.attr('data-sort', sort);
                    }
                }
            }
        );

        // new MDCDataTable($elem);
    }
}

export {
    MDCFormField, MDCRipple, MDCSelect, MDCCheckbox, MDCDataTable, MDCMenu, UIHelper
}