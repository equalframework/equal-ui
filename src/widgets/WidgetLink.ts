import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

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
        let $button_open = UIHelper.createButton('link-actions-open-' + this.id, '', 'icon', 'link').addClass('widget-link-btn');

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
                    if(value.length > 0) {
                        if(this.config.hasOwnProperty('link') && this.config.link == 'icon'){
                            this.$elem.append($button_open);
                        }
                        else {
                            let $link = $('<a target="_blank" href="' + value + '">' + value + '</a>');
                            $link.on('click', (event) => {
                                event.stopPropagation();
                            })
                            this.$elem.append($link);
                        }
                    }
                }
                else {
                    let $input = UIHelper.createInputView('', this.label, value, this.config.description).css({"width": "calc(100% - 48px)", "display": "inline-block"});
                    this.$elem.append($input).append($button_open);
                }
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}