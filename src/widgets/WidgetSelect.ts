import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetSelect extends Widget {

    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        console.debug('WidgetSelect::change', value);
        this.$elem.trigger('select', value);
    }

    public render():JQuery {
        let value:string = this.value ? this.value : '';
        let usage = (this.config.hasOwnProperty('usage')) ? this.config.usage : '';

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createSelect('widget-select_' + this.getId(), this.label, this.config.values, value, this.config.description, this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                let $select = this.$elem.find('.mdc-select__anchor');
                let $menu = this.$elem.find('.mdc-menu');
                // assign displayed value
                this.$elem.trigger('select', value);
                // setup handler for relaying value update to parent layout
                this.$elem.find('input').on('change', (event) => {
                    console.debug('WidgetSelect : received change event');
                    let $this = $(event.currentTarget);
                    this.value = $this.val();
                    this.$elem.trigger('_updatedWidget');
                });

                if(usage.indexOf('color') >= 0) {
                    this.$elem.find('.mdc-select__selected-text').before( $('<span style="height: 20px;min-width: 20px;background: '+value+';border-radius: 50%;margin-right: 10px;transform: translateY(4px);"></span>') );
                    this.$elem.find('li').each( (i, elem) => {
                        let color = $(elem).data('value');
                        $(elem).prepend( $('<span style="height: 20px;width: 20px;background: '+color+';border-radius: 50%;margin-right: 10px;"></span>') );
                    });
                }

                // if field is empty, open menu on focus
                $select.on('focus', (event:any) => {
                        if(value == '' && !$menu.hasClass('mdc-menu-surface--open')) {
                            $menu.trigger('_open');
                        }
                    });

                $select.on('keyup', (event:any) => {
                        console.debug('WidgetSelect: received keyup');

                        // tab
                        if(event.which == 9) {
                            // do nothing
                        }
                        // esc
                        else if(event.which == 27) {
                            $menu.trigger('_close');
                        }
                        // enter
                        else if(event.which == 13) {
                            // #memo - this triggers a click on the menu, which triggers a menu close
                            $menu.trigger('_select');
                        }
                        // up arrow
                        else if(event.which == 38) {
                            if(!$menu.hasClass('mdc-menu-surface--open')) {
                                $menu.trigger('_open');
                            }
                            else {
                                $menu.trigger('_moveup');
                            }
                        }
                        // down arrow
                        else if(event.which == 40) {
                            if(!$menu.hasClass('mdc-menu-surface--open')) {
                                $menu.trigger('_open');
                            }
                            else {
                                $menu.trigger('_movedown');
                            }
                        }
                    });
                break;
            case 'view':
            default:
                let val:string = Array.isArray(this.config.values) ? value : ( (this.config.values.hasOwnProperty(value)) ? this.config.values[value] : '' );
                this.$elem = UIHelper.createInputView('', this.label, val, this.config.description);

                if(usage.indexOf('color') >= 0) {
                    this.$elem.find('input').before( $('<span style="min-height: 20px;min-width: 20px;background: '+value+';border-radius: 50%;margin-right: 10px;transform: translateY(5px);"></span>') );
                }

                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

}