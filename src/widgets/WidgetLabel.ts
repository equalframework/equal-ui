import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetLabel extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public render(): JQuery {
        let value: any = (typeof this.value != undefined && this.value != undefined) ? this.value : '';
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }

        this.$elem = $('<span style="display: inline-block; width: 100%; height: 46px; padding-top: 24px; line-height: 22px;" />');

        let $text = $('<span style="display: inline-block; line-height: 22px;">' + value + '</span>')
            // default layout
            .css({
                'font-weight': '600',
                'width': '100%'
            })
            .appendTo(this.$elem);

        // decorate the widget according to styles present in config
        this.applyStyling($text);

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId());
    }


}