import Widget from "./Widget";
import Layout from "../Layout";

import { UIHelper } from '../material-lib';

export default class WidgetLink extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'string', label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').val(value).trigger('change');
    }

    public render():JQuery {
        let value:string = (typeof this.value != undefined && this.value != undefined)?this.value:'';
        let $button_open = UIHelper.createButton('link-actions-open-'+this.id, '', 'icon', 'open_in_new');

        // open target in new window
        $button_open.on('click', async (event) => {
            event.stopPropagation();
            if(window) {
                let w = window.open(value, '_blank');
                if(w) {
                    w.focus();
                }
            }
        });
        
        switch(this.mode) {
            case 'edit':
                
                if(this.config.layout == 'list') {
                    this.$elem = UIHelper.createInput('', this.label, value, this.config.description, '', this.readonly);
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                else {
                    this.$elem = $('<div />');
                    let $input = UIHelper.createInput('', this.label, value, this.config.description, '', this.readonly).css({"width": "calc(100% - 48px)", "display": "inline-block"});
                    this.$elem.append($input).append($button_open);
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
                this.$elem = $('<div />');

                if(this.config.layout == 'list') {
                    this.$elem.append('<a target="_blank" href="'+value+'">'+value+'</a>');
                }
                else {
                    let $input = UIHelper.createInputView('', this.label, value).css({"width": "calc(100% - 48px)", "display": "inline-block"});
                    this.$elem.append($input).append($button_open);
                }

                break;
        }

        if(this.config.hasOwnProperty('header') && this.getLayout().getView().getType() == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}