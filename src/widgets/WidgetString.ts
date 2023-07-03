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
        let usage = (this.config.hasOwnProperty('usage'))?this.config.usage:'';

        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }
        switch(this.mode) {
            case 'edit':

                // support for adding selection after onchange
                // #todo - merge with WidgetSelect
                if(this.config.hasOwnProperty('selection')) {
                    this.$elem = UIHelper.createSelect(this.getId(), this.label, this.config.selection, value, this.config.description, this.readonly);
                }
                else {
                    this.$elem = UIHelper.createInput('string_'+this.id, this.label, value, this.config.description, '', this.readonly);
                }

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

                if(this.config.layout == 'list') {
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
                    if(this.config.layout == 'list') {
                        if(usage.indexOf('icon') >= 0) {
		                    let map_icons:any = {
                                	success:  {icon: "check_circle", color: "green"},
                                    info:     {icon: "info", color: "blue"},
                                    warn:     {icon: "warning", color: "orange"},
                                    major:    {icon: "error", color: "orangered"},
                                    error:    {icon: "report", color: "red"},
                                    paid:  {icon: "paid", color: "green"},
                                    due:  {icon: "money_off", color: "red"},
                            };

                            this.$elem = $('<div />');
                            if(map_icons.hasOwnProperty(value)) {
                                this.$elem.append( $('<span class="material-icons">' + map_icons[value].icon + '</span>').css({color: map_icons[value].color}) );
                            }
                            else {
                                this.$elem.append( $('<span class="material-icons">' + value + '</span>') );
                            }
                            this.$elem.css({"width": "100%", "text-align": "center"});
                        }
                        else {
                            this.$elem = $('<div />').html(value);
                            this.$elem.css({"width": "100%", "height": "auto", "max-height": "calc(44px - 2px)", "white-space": "break-spaces", "overflow": "hidden"});
                        }
                    }
                    else {
                        this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                    }
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