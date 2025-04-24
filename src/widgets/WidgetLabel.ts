import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetLabel extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'string', label, value, config);
    }


    public render():JQuery {
        let value:any = (typeof this.value != undefined && this.value != undefined)?this.value:'';
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }

        this.$elem = $('<span style="display: inline-block; font-weight: 600; height: 46px; padding-top: 24px; line-height: 22px;">'+value+'</span>');

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}