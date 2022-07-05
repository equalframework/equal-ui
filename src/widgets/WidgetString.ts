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
                this.$elem = UIHelper.createInput('string_'+this.id, this.label, value, this.config.description, '', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }

                // #memo - not dealing with keydown is preferred to avoid confusion about special keys role
                // #memo - we use 'change' event to cover float and integers changes with up and down buttons (same timeout)
                this.$elem.find('input').on('change', (event:any) => {
                    let $this = $(event.currentTarget);

                    if(this.value != $this.val()) {
                        this.value = $this.val();
                        this.$elem.trigger('_updatedWidget', [false]);
                    }
                });

                break;
            case 'view':
            default:
                let $link;

                if(this.config.layout == 'list' && this.config.hasOwnProperty('usage')) {
                    let usage = this.config.usage;
                    if(usage.indexOf('phone') >= 0) {
                        $link = $('<a target="_blank" href="tel:'+value+'">'+value+'</a>');
                        $link.on('click', (event) => {
                            event.stopPropagation();
                        });
                    }
                    else if(usage.indexOf('email') >= 0) {
                        $link = $('<a target="_blank" href="mailto:'+value+'">'+value+'</a>');
                        $link.on('click', (event) => {
                            event.stopPropagation();
                        });
                    }
                }

                if($link) {
                    this.$elem = $('<div />');
                    this.$elem.append($link);
                }
                else {
                    this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                    this.$elem.attr('title', value);
                }

                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}