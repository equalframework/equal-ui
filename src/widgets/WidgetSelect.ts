import Widget from "./Widget";
import Layout from "../Layout";

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
        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createSelect('', this.label, this.config.values, value, this.config.description, this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                // setup handler for relaying value update to parent layout
                this.$elem.find('input').on('change', (event) => {
                    console.log('WidgetSelect : received change event');
                    let $this = $(event.currentTarget);
                    this.value = $this.val();
                    this.$elem.trigger('_updatedWidget');
                });
                break;
            case 'view':
            default:
                let val:string = Array.isArray(this.config.values)?value:this.config.values[value];
                this.$elem = UIHelper.createInputView('', this.label, val, this.config.description);
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());

        return this.$elem;
    }
    
}