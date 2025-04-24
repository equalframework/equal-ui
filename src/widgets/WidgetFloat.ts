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
        this.value = (isNaN(res)) ? 0 : res;
        return this;
    }

    public render(): JQuery {
        this.$elem = super.render();
        let $input = this.$elem.find('input');

        // numeric fields are aligned right
        $input.css({'text-align': 'right'});
        // allow decimal digits
        // #todo - handle precision from usage
        $input.attr('step', '0.01');

        if(this.mode == 'edit') {
            $input.attr( "type", "number" );
            // #memo - browser accepts only one separator: . or ,
            $input.val(this.value);
            // #todo - handle config.onfocus : 'none', 'select', 'reset'
            $input.on('focus', function() {
                $input.trigger('select');
            });

        }
        else if(this.mode == 'view') {
            // use parent::toString()
            let value: string = this.toString();

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