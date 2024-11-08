import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetTime extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'string', label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').val(value).trigger('change');
    }

    public render():JQuery {
        // #todo - adaptIN - times should always be UTC - we should apply time offset here
        let value:any = this.value ?? '';
        // if we received a date, convert it to a string
        if(Object.prototype.toString.call(value) === '[object Date]') {
            // #todo - adaptIN - we should rather use `toUTCString()`
            value = value.toTimeString().substring(0, 5);
        }

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createInput('time_'+this.id, this.label, value, this.config.description, '', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }

                // #memo - not dealing with keydown is preferred to avoid confusion about special keys role
                // #memo - we use 'change' event to cover float and integers changes with up and down buttons (same timeout)
                this.$elem.find('input').on('change', (event:any) => {
                    let $this = $(event.currentTarget);

                    // #todo - adapt-OUT - times should always be UTC - we should apply time offset here
                    if(this.value != $this.val()) {
                        this.value = $this.val();
                        this.$elem.trigger('_updatedWidget', [false]);
                    }
                });

                break;
            case 'view':
            default:
                if(this.config.layout == 'list') {
                    this.$elem = $('<div />').html(value);
                    // time fields are aligned right
                    this.$elem.css({
                        'width': '100%',
                        'text-align': 'right',
                        'height': 'auto',
                        'max-height': 'calc(44px - 2px)',
                        'white-space': 'break-spaces',
                        'overflow': 'hidden'});
                }
                else {
                    this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                }
                this.$elem.attr('title', value);
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}