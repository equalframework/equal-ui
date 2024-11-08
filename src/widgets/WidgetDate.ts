import Widget from "./Widget";
import Layout from "../layouts/Layout";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDate extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'date', label, value, config);
    }

    private jqueryToMomentFormat(format: string): string {
        let result: string = format;
        const formatAdapter : any = {
            'dd': 'DD',
            'mm': 'MM',
            'yy': 'YYYY'
        };
        for(const key in formatAdapter) {
            let re = new RegExp(key, 'g');
            result = result.replace(re, formatAdapter[key]);
        }
        return result;
    }

    /**
     * Converts a date from jquery-ui format (dateFormat) to ISO string according to provided format.
     * Uses moment.js for the formatting.
     *
     * @param date
     * @param format
     */
    private adaptFromDateFormat(date: any, format: string): string {
        return moment(date).format(this.jqueryToMomentFormat(format));
    }

    public change(value: any) {
        // #memo - this is used by inline edit for list views : we cannot trigger a change since it would result in infinite loop (triggering _updatedWidget)
        console.debug('WidgetDate::change', value);
        let $datepicker = this.$elem.find('.datepicker');
        let format = $datepicker.datepicker('option', 'dateFormat');
        let date = new Date();
        if(value && value.length) {
            date = new Date(value);
        }
        let str_date = this.adaptFromDateFormat(date, format);
        this.$elem.find('.datepicker').datepicker('setDate', date);
        this.$elem.find('input').first().val((value && value.length)?str_date:'');
    }

    public render(): JQuery {
        let date = new Date(this.value);
        if(this.value && this.value.length) {
            date = new Date(this.value);
        }
        let value: any;
        let format: any;
        switch(this.mode) {
            case 'edit':
                let $datetimepicker = $('<input type="text" />').addClass('datepicker sb-widget-datetime-datepicker');

                let datepickerConfig = {
                        autoOpen: false,
                        ...jqlocale[this.getLayout().getEnv().locale],
                        onClose: () => {
                            // relay only in case of change, and if string value is not empty
                            let newDate = $datetimepicker.datepicker('getDate');
                            let str_date: string = <string> this.$elem.find('input').first().val();
                            if(date.getTime() != newDate.getTime() && str_date.length > 0) {
                                console.debug('onclose', date.getTime(), newDate.getTime(), str_date.length);
                                // make the date UTC @ 00:00:00
                                let timestamp = newDate.getTime();
                                let offset_tz = newDate.getTimezoneOffset()*60*1000;
                                this.value = (new Date(timestamp-offset_tz)).toISOString().substring(0, 10)+'T00:00:00Z';
                                this.$elem.trigger('_updatedWidget');
                            }
                        }
                    };

                // #memo - in some cases datepicker fails to parse the date with applied format, and falls back to defaultDate
                datepickerConfig.defaultDate = date;

                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage && (this.config.usage == 'month' || this.config.usage.indexOf('date/month') == 0)) {
                        if(datepickerConfig.hasOwnProperty('dateFormat_month')) {
                            datepickerConfig.dateFormat = datepickerConfig.dateFormat_month;
                        }
                    }
                }

                // convert jquery format to moment format
                format = datepickerConfig.dateFormat;
                value = (this.value)?this.adaptFromDateFormat(date, format):'';

                this.$elem = UIHelper.createInput('date_'+this.id, this.label, value, this.config.description, '', this.readonly);

                let $input = this.$elem.find('input').first()
                    .on('keydown', (event:any) => {
                        if(event.which == 9) {
                            event.stopImmediatePropagation();
                        }
                    })
                    .on('change', (event) => {
                        console.debug('WidgetDate:: input change', event);
                        let $this = $(event.currentTarget);
                        let date = new Date();
                        let mdate = moment($this.val(), this.jqueryToMomentFormat(format), true);
                        if(mdate.isValid()) {
                            date = mdate.toDate();
                            console.debug('WidgetDate::valid date received', date);
                        }
                        else {
                            console.debug('WidgetDate::invalid date received, fallback to current', date);
                        }
                        // make the date UTC @ 00:00:00
                        let timestamp = date.getTime();
                        let offset_tz = date.getTimezoneOffset()*60*1000;
                        this.value = (new Date(timestamp-offset_tz)).toISOString().substring(0, 10)+'T00:00:00Z';
                        $datetimepicker.datepicker('setDate', date);
                        this.$elem.trigger('_updatedWidget');
                    });

                let $button_open = UIHelper.createButton('date-actions-open_'+this.id, '', 'icon', 'calendar_today')
                    .css({"position": "absolute", "right": "5px", "top": "5px", "z-index": "1"})
                    .on('focus', () => $datetimepicker.datepicker('show') )
                    .on('click', () => {
                        $datetimepicker.datepicker('show');
                        let val = <string> $input.val();
                        if(!val.length) {
                            $input.val(this.adaptFromDateFormat(new Date(), format)).trigger('change');
                        }
                    });

                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                    $button_open.css({"top": "2px"});
                }

                $button_open.insertAfter($input);

                $datetimepicker.datepicker(datepickerConfig)
                    .on('keydown', (event: any) => {
                        // prevent relaying key events to datepicker
                        event.stopImmediatePropagation();
                    })
                    .on('change', (event:any) => {
                        // update widget value using jQuery `getDate`
                        let $this = $(event.currentTarget);
                        let newDate = $this.datepicker('getDate');
                        console.debug('WidgetDate::datepicker native change', newDate);
                        this.$elem.find('input').first().val(this.adaptFromDateFormat(newDate, format));
                    });

                $datetimepicker.datepicker('setDateTime', date);

                this.$elem.append($datetimepicker);

                break;
            case 'view':
            default:
                // moment 'll': en = "Jul 8, 2023"; fr = "8 juil. 2023"
                format = 'll';
                // #todo - adapt and complete based on retrieved locale from equal (@see packages/core/i18n/.../locale.json)
                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage == 'date' || this.config.usage == 'date/medium' || this.config.usage == 'date/plain.medium') {
                        // 06/08/2023
                        format = 'L';
                    }
                    else if(this.config.usage == 'date/short' || this.config.usage == 'date/plain.short') {
                        // 06/08/23
                        format = (moment.localeData().longDateFormat('L')).replace(/YYYY/g,'YY');
                    }
                    else if(this.config.usage == 'date/plain.short.day') {
                        format = 'dd ' + (moment.localeData().longDateFormat('L')).replace(/YYYY/g,'YY');
                    }
                    else if(this.config.usage == 'month' || this.config.usage.indexOf('date/month') == 0) {
                        format = 'MMM YYYY';
                    }
                }

                // convert date to string, according to locale and usage
                value = (this.value) ? moment(date).format(format) : '';

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

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}