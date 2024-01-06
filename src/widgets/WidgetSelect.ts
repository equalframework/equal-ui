import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetSelect extends Widget {

    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, 'select', label, value, config);
    }

    public change(value: any) {
        this.$elem.trigger('select', value);
    }

    public render():JQuery {
        let value:string = this.value?this.value:'';
        let usage = (this.config.hasOwnProperty('usage'))?this.config.usage:'';

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createSelect(this.getId(), this.label, this.config.values, value, this.config.description, this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
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

                break;
            case 'view':
            default:
                let val:string = Array.isArray(this.config.values)?value:(this.config.values.hasOwnProperty(value))?this.config.values[value]:'';
                this.$elem = UIHelper.createInputView('', this.label, val, this.config.description);

                if(usage.indexOf('color') >= 0) {
                    this.$elem.find('input').before( $('<span style="min-height: 20px;min-width: 20px;background: '+value+';border-radius: 50%;margin-right: 10px;transform: translateY(5px);"></span>') );
                }

                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}