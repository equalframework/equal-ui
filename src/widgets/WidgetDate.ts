import Widget from "./Widget";
import Layout from "../layouts/Layout";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDate extends Widget {


    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'date', label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').datepicker('setDate', value).trigger('change');
    }

    public render(): JQuery {
        let date = new Date(this.value);
        let value:any;
         // moment 'll': Jun 8, 2023
        let format = 'll';
        switch(this.mode) {
            case 'edit':
                format = 'L';
                value = moment(date).format(format);
                this.$elem = UIHelper.createInput('date_'+this.id, this.label, value, this.config.description, 'calendar_today', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                // setup handler for relaying value update to parent layout
                this.$elem.find('input')
                .datepicker( {
                    showOn: "button",
                    ...jqlocale[this.getLayout().getEnv().locale],
                    onClose: () => {
                        // give the focus back once the widget will have been refreshed
                        setTimeout( () => {
                            $('#'+this.getId()).find('input').first().trigger('focus');
                        }, 250);
                    }
                } )
                .on('change', (event:any) => {
                    // update widget value using jQuery `getDate`
                    let $this = $(event.currentTarget);
                    let date = $this.datepicker('getDate');
                    console.debug('widget selected date', date);
                    // make the date UTC @ 00:00:00
                    let timestamp = date.getTime();
                    let offset_tz = date.getTimezoneOffset()*60*1000;
                    this.value = (new Date(timestamp-offset_tz)).toISOString().substring(0, 10)+'T00:00:00Z';
                    console.debug('widget assigned date', this.value);
                    this.$elem.trigger('_updatedWidget');
                });
                this.$elem.find('button').attr('tabindex', -1);
                break;
            case 'view':
            default:
                // #todo - adapt and complete based on retrieved locale from equal (@see packages/core/i18n/fr/locale.json)
                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage == 'date' || this.config.usage == 'date/medium') {
                        // 06/08/2023
                        format = 'L';
                    }
                    else if(this.config.usage == 'date/short') {
                        // 06/08/23
                        format = (moment.localeData().longDateFormat('L')).replace(/YYYY/g,'YY');
                    }
                }

                // convert date to string, according to locale and usage
                value = (this.value)?moment(date).format(format):'';

                // by convention, first column of each row opens the object no matter the type of the field
                if(this.is_first) {
                    this.$elem = $('<div />').addClass('is-first').text(value);
                }
                else {
                    this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                }
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
    }

}