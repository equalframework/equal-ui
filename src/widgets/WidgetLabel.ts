import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetLabel extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }


    public render(): JQuery {
        let value:any = (typeof this.value != undefined && this.value != undefined)?this.value:'';
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }

        this.$elem = $('<span style="display: inline-block; width: 100%; height: 46px; padding-top: 24px; line-height: 22px;" />');

        let $text = $('<span style="display: inline-block; line-height: 22px;">' + value + '</span>').appendTo(this.$elem);

        // default layout
        $text.css({'font-weight': '600'});
        $text.css({'width': '100%'});


        if(this.config.hasOwnProperty('text_decoration') && this.config.text_decoration) {
            if(this.config.text_decoration === 'underline') {
                $text.css({'border-bottom': 'solid 1px black'});
            }
        }

        if(this.config.hasOwnProperty('text_color') && this.config.text_color) {
            $text.css({'color': this.config.text_color});
        }

        if(this.config.hasOwnProperty('text_width') && this.config.text_width) {
            $text.css({
                    'width': this.normalizeToPx(this.config.text_width),
                    'min-width': this.normalizeToPx(this.config.text_width)
                });
        }

        if(this.config.hasOwnProperty('background_color') && this.config.background_color) {
            $text.css({'background-color': this.config.background_color});
        }

        if(this.config.hasOwnProperty('border_radius') && this.config.border_radius) {
            $text.css({'border-radius': this.normalizeToPx(this.config.text_color)});
        }

        if(this.config.hasOwnProperty('padding') && this.config.padding) {
            $text.css({'padding': this.config.padding});
        }

        if(this.config.hasOwnProperty('margin') && this.config.margin) {
            $text.css({'margin': this.config.margin});
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

    private normalizeToPx(v: any): string {
        let n = (typeof v === 'number') ? v : parseInt(v as string, 10);
        if(isNaN(n)) {
            n = 0;
        }
        return `${n}px`;
    };

}