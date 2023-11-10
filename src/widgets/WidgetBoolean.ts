import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';


export default class WidgetBoolean extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'boolean', label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').val(value).trigger('change');
    }

    public render():JQuery {

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createSwitch('bool_'+this.id, this.label, this.value, this.config.description, '', this.readonly);

                // setup handler for relaying value update to parent layout
                this.$elem.find('input')
                .on('change', (event:any) => {
                    let $this = $(event.currentTarget);
                    this.value = $this.prop( "checked" )
                    this.$elem.trigger('_updatedWidget');
                });
                break;
            case 'view':
            default:
                /*
                let value:string = (this.value)?'true':'false';
                $elem = UIHelper.createInputView('', this.label, value);
                */
                this.$elem = UIHelper.createSwitch('', this.label, this.value, this.config.description, '', true);
                break;
        }
        return this.$elem.addClass('sb-widget').addClass('sb-widget-type-boolean').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }
}
