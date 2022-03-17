import Widget from "./Widget";
import Layout from "../Layout";

import { UIHelper } from '../material-lib';
import { TranslationService } from "../equal-services";

export default class WidgetFile extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'file', label, value, config);
    }

    public change(value: any) {
        // this.$elem.find('input').val(value).trigger('change');
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

        this.$elem = $('<div />');
        

        switch(this.mode) {
            case 'edit':
                this.$elem.css({"display": "flex", "align-items": "center"});
                let $input:JQuery = $('<input type="file" />').hide();
                
                let $button = UIHelper.createButton(this.getId()+'_upload-button', TranslationService.instant('SB_ACTIONS_BUTTON_SELECT'), 'raised', '', 'primary').css({"margin-left": "10px"});

                let $text = UIHelper.createInputView('', this.label, '', this.config.description);
                $text.on('click', () => $input.trigger('click') );
                $button.on('click', () => $input.trigger('click') );
                $input.on('change', async (event:any) => {
                    console.log(event);
                    let val:string = <string>$input.val();
                    this.value = await ( ( blob:any ) => {
                        let defer = $.Deferred();
                        var reader = new FileReader();
                        reader.onload = (e:any) => {
                            defer.resolve(e.target.result);
                        };
                        reader.readAsDataURL(blob);
                        return defer.promise();
                    })($input.prop('files')[0]);
                    let filename = <string>val.split('\\').pop();
                    $text.remove();
                    $text = UIHelper.createInputView('', this.label, filename, this.config.description);
                    this.$elem.prepend($text);

                });
                this.$elem.append($text).append($button).append($input);

                break;
            case 'view':
            default:

                this.$elem.append('binary data');
                break;
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}