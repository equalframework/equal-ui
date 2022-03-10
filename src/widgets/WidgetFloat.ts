import Widget from "./Widget";
import Layout from "../Layout";

import WidgetString from "./WidgetString";

import { UIHelper } from '../material-lib';

export default class WidgetFloat extends WidgetString {
    

    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
    }

    public setValue(value: any) {
        console.log('WidgetFloat::setValue', value);
        this.value = Number.parseFloat(value);
        return this;
    }

    public render():JQuery {
        this.$elem = super.render();
        let $input = this.$elem.find('input');
        $input.attr( "type", "number" );
        if(this.mode == 'view') {
            // in view mode, display 2 decimal digits
            let value = String( (Math.round(this.value * 100) / 100).toFixed(2) );
            $input.val(value);
        }
        return this.$elem;
    }

    
}