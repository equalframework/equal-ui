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
        var power = Math.pow(10, 2);
        this.value = String( (Math.round(value * power) / power).toFixed(2) );
        return this;
    }

    public render():JQuery {
        this.$elem = super.render();
        this.$elem.find('input').attr( "type", "number" );
        return this.$elem;
    }

    
}