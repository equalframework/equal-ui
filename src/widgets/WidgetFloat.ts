import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import WidgetString from "./WidgetString";

import { UIHelper } from '../material-lib';
import { EnvService } from '../equal-services';


export default class WidgetFloat extends WidgetString {


    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
    }

    public setValue(value: any) {
        let res = Number.parseFloat(value);
        this.value = (isNaN(res))?0:res;
        return this;
    }

    public render():JQuery {
        this.$elem = super.render();
        let $input = this.$elem.find('input');

        // numeric fields are aligned right
        $input.css({'text-align': 'right'});

        if(this.mode == 'edit') {
            $input.attr( "type", "number" );

            // #todo - handle config.onfocus : 'none', 'select', 'reset'
            $input.on('focus', function() {
                $input.trigger('select');
            });

        }
        else if(this.mode == 'view') {
            // in view mode, display 2 decimal digits
            let value:any = this.value;

            if(this.config.hasOwnProperty('usage')) {
                let usage = this.config.usage;
                if(usage.indexOf('amount/percent') >= 0 || usage.indexOf('amount/rate') >= 0) {
                    value = (value * 100).toFixed(0) + '%';
                }
                else if(usage.indexOf('amount/money') >= 0) {
                    value = EnvService.formatCurrency(value);
                }
                else {
                    value = EnvService.formatNumber(value);
                }
            }
            else {
                value = EnvService.formatNumber(value);
            }

            // for lists, item is a DIV
            if(this.config.layout == 'list') {
                this.$elem.html(value);
                this.$elem.css({"text-align": "right", "white-space": "nowrap"});
            }
            else {
                $input.val(value);
            }
        }
        return this.$elem;
    }


}