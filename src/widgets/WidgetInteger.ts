import Widget from "./Widget";
import WidgetString from "./WidgetString";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetInteger extends WidgetString {

    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
    }

    public render():JQuery {
        this.$elem = super.render();
        let $input = this.$elem.find('input');

        // #memo - numeric fields are aligned right (except for `id` column or if explicitly set otherwise in config), as set in getWidgetConfig
        $input.css({'text-align': this.config.align});

        if(this.mode == 'edit') {
            $input.attr( "type", "number" );
            if(this.config.hasOwnProperty('min')) {
                $input.attr( "min", this.config.min );
            }
            if(this.config.hasOwnProperty('max')) {
                $input.attr( "max", this.config.max );
            }
        }
        else if(this.mode == 'view') {
            // for lists, item is a DIV
            this.$elem.css({'text-align': this.config.align});
        }

        return this.$elem;
    }
}