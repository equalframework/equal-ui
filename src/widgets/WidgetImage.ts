import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetImage extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        // this.$elem.find('input').val(value).trigger('change');
    }

    public render(): JQuery {
        let value: string = (typeof this.value != undefined && this.value != undefined) ? this.value : '';
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

        let content_type = (this.config.hasOwnProperty('usage')) ? this.config.usage : 'image/jpeg';

        this.$elem = $('<div />').addClass('sb-image-thumbnail');

        switch(this.mode) {
            case 'edit':

                this.$elem.addClass('sb-dropable')
                this.$elem.css({'background-image': 'url(' + 'data:' + content_type + ';base64,' + value + ')'});

                if(window.File && window.FileReader && window.FileList && window.Blob) {
                    window.addEventListener("dragover", (e) => e.preventDefault());
                    // window.addEventListener("drop", (e) => e.preventDefault() );
                    this.$elem.on("dragenter", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.$elem.addClass("highlight");
                    });

                    this.$elem.on("dragleave", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.$elem.removeClass("highlight");
                    });

                    this.$elem.on("dragover", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    });

                    this.$elem[0].addEventListener("drop", async (event:any) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.$elem.removeClass("highlight");
                        if(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
                            // we want to store the data inside the Model field
                            let file = event.dataTransfer.files[0];
                            let value = await ( ( blob:any ) => {
                                let defer = $.Deferred();
                                var reader = new FileReader();
                                reader.onload = (e:any) => {
                                    defer.resolve(e.target.result);
                                };
                                reader.readAsDataURL(blob);
                                return defer.promise();
                            })(file);

                            this.value = value;
                            this.$elem.trigger('_updatedWidget', [false]);
                        }
                    });
                }

                break;
            case 'view':
            default:

                this.$elem.css({'background-image': 'url(' + 'data:' + content_type + ';base64,' + value + ')'});

                break;
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}