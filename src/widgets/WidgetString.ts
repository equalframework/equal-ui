import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetString extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'string', label, value, config);
    }

    public change(value: any) {        
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }
        this.$elem.find('input').val(value).trigger('change');
    }

    public render():JQuery {
        let value:any = (typeof this.value != undefined && this.value != undefined)?this.value:'';
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }
        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createInput('', this.label, value, this.config.description, '', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                // setup handler for relaying value update to parent layout
                this.$elem.find('input').on('change', (event) => {
                    let $this = $(event.currentTarget);
                    this.value = $this.val();
                    if(this.value != value) {
                        this.$elem.trigger('_updatedWidget', [false]);
                    }
                });
                break;
            case 'view':
            default:
                this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}