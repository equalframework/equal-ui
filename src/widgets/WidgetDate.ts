import Widget from "./Widget";
import Layout from "../layouts/Layout";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDate extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    private jqueryToMomentFormat(format: string): string {
        let result: string = (format ?? 'dd/mm/yy');
        const formatAdapter : any = {
            'dd': 'DD',
            'mm': 'MM',
            'yy': 'YYYY',
            'hh': 'HH',
            'ii': 'mm'
        };
        for(const key in formatAdapter) {
            let re = new RegExp(key, 'g');
            result = result.replace(re, formatAdapter[key]);
        }
        return result;
    }

    /**
     * Converts a date object to a string according to provided format.
     * Uses moment.js for the formatting.
     *
     * @param date
     * @param moment_format
     */
    private dateToString(date: Date, moment_format: string): string {
        return moment(date).format(moment_format);
    }

    private stringToDate(date_str: string, moment_format: string): Date | null {
        let mdate = moment(date_str, moment_format, true);
        if(mdate.isValid()) {
            return mdate.toDate();
        }
        return null;
    }
    private isValidIsoStringDate(date_str: string): boolean {
        return moment(date_str, moment.ISO_8601, true).isValid();
    }

    private isValidStringDate(date_str: string, moment_format: string): boolean {
        let mdate = moment(date_str, moment_format, true);
        return mdate.isValid();
    }

    private formatIsoStringDate(date_str: string, moment_format: string): string {
        return moment(date_str).format(moment_format);
    }

    public change(value: string | null) {
        // #memo - this is used by inline edit for list views : we cannot trigger a change since it would result in infinite loop (triggering _updatedWidget)
        console.debug('WidgetDate::change', value);
        let $datepicker = this.$elem.find('.datepicker');
        let $input = this.$elem.find('input').first();
        if($datepicker.length > 0) {
            if(!this.isValidIsoStringDate(value || '')) {
                $input.val('');
            }
            else {
                let moment_format = this.jqueryToMomentFormat($datepicker.datepicker('option', 'dateFormat'));
                let date = new Date(<string> value);
                $datepicker.datepicker('setDate', date);
                $input.val(this.dateToString(date, moment_format));
            }
        }
    }

    public render(): JQuery {
        console.debug('WidgetDate::render', this);
        const locale = this.getLayout().getEnv().locale.slice(0, 2);
        // #memo - this.value is expected to be either null or a valid ISO date string at all times
        let value_str: string = '';
        // set default moment format is 'll': en = "Jul 8, 2023"; fr = "8 juil. 2023"
        let moment_format: string = 'll';

        switch(this.mode) {
            case 'edit':
                console.debug('WidgetDate:: rendering edit mode');
                let $datetimepicker = $('<input type="text" />').addClass('datepicker sb-widget-datetime-datepicker');

                let datepickerConfig = {
                        ...jqlocale[locale],
                        autoOpen: false,
                        onClose: () => {
                            // disable events on closing datepicker popup
                            // this will result in datepicker setDate, this.value assignment and trigger _updatedWidget
                            this.$elem.find('input').first().trigger('change');
                        },
                        onSelect: (date_str: string) => {
                            console.log('WidgetDate::datepicker:onSelect', date_str);
                            if(this.isValidStringDate(date_str, this.jqueryToMomentFormat(datepickerConfig.dateFormat))) {
                                console.debug('WidgetDate::datepicker:onSelect valid date received', date_str);
                                // assign input but do not relay change event (done only in `onClose`)
                                this.$elem.find('input').first().val(date_str).trigger('input');
                            }
                            else {
                                console.debug('WidgetDate::datepicker:onSelect invalid date received, fallback to current', date_str);
                            }
                        }
                    };

                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage && (this.config.usage == 'month' || this.config.usage.indexOf('date/month') == 0)) {
                        if(datepickerConfig.hasOwnProperty('dateFormat_month')) {
                            console.debug('WidgetDate::init setting date format for month', datepickerConfig.dateFormat_month);
                            datepickerConfig.dateFormat = datepickerConfig.dateFormat_month;
                        }
                    }
                }

                // convert jquery format to moment format
                moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat);
                console.debug('WidgetDate::init retrieved moment format', moment_format);

                if(this.isValidIsoStringDate(this.value || '')) {
                    console.debug('WidgetDate::init valid value', this.value);
                    value_str = this.formatIsoStringDate(this.value, moment_format);
                    datepickerConfig.defaultDate = new Date(this.value);
                }
                else {
                    console.debug('WidgetDate::init invalid value', this.value);
                }

                this.$elem = UIHelper.createInput('date_' + this.id, this.label, value_str, this.config.description, '', this.readonly);

                let $input = this.$elem.find('input').first()
                    .on('keydown', (event:any) => {
                        // prevent relaying tab keydown
                        if(event.which == 9) {
                            event.stopImmediatePropagation();
                        }
                    })
                    .on('change', (event) => {
                        let $this = $(event.currentTarget);
                        let date_str: string = <string> $this.val();
                        let moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat);
                        date_str = this.autoFormatDateInput(date_str, moment_format);
                        console.debug('WidgetDate::input:change', event, date_str);

                        if(this.isValidStringDate(date_str, moment_format)) {
                            console.debug('WidgetDate::input:change valid date received', date_str);
                            let date: Date = <Date> this.stringToDate(date_str, moment_format);
                            // make the date UTC @ 00:00:00
                            let timestamp = date.getTime();
                            let offset_tz = date.getTimezoneOffset()*60*1000;
                            this.value = (new Date(timestamp-offset_tz)).toISOString().substring(0, 10) + 'T00:00:00Z';
                            if($datetimepicker.data('datepicker')) {
                                $datetimepicker.datepicker('setDate', date);
                            }
                            this.$elem.trigger('_updatedWidget');
                        }
                        else {
                            // handle field reset
                            if(date_str === '') {
                                this.value = null;
                                this.$elem.trigger('_updatedWidget');
                            }
                            else {
                                console.debug('WidgetDate::input:change invalid date received, ignoring', date_str);
                            }
                        }
                    });

                let $button_open = UIHelper.createButton('date-actions-open_' + this.id, '', 'icon', 'calendar_today')
                    .css({"position": "absolute", "right": "5px", "top": "7px", "z-index": "1"})
                    .on('focus click', () => {
                        let $input = this.$elem.find('input').first();
                        let val: string = <string> $input.val();
                        let moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat);
                        // upon opening of the date picker, if input is empty, assign current date
                        if(!val.length) {
                            let date = new Date();
                            // #memo - do not trigger change here, since it would result in layout refresh and loss of datepicker instance data
                            $input.val(this.dateToString(date, moment_format));
                            // force MDC refresh (text.layout())
                            $input.trigger('input');
                        }
                        $datetimepicker.datepicker('show');
                    });

                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                    $button_open.css({"top": "2px"});
                }

                if(!this.readonly) {
                    $button_open.insertAfter($input);
                }

                $datetimepicker.datepicker(datepickerConfig)
                    .on('keydown', (event: any) => {
                        // prevent relaying key events to datepicker
                        event.stopImmediatePropagation();
                    })
                    .on('change', (event: any) => {
                        // prevent relaying change event on datepicker input (we use either datepicker:onSelect or input:change)
                        event.stopImmediatePropagation();
                    });

                // #memo - initial setDate is mandatory for further interactions with datepicker popup
                if(this.isValidIsoStringDate(this.value || '')) {
                    $datetimepicker.datepicker('setDate', new Date(this.value));
                }
                else {
                    $datetimepicker.datepicker('setDate', new Date());
                }

                this.$elem.append($datetimepicker);

                break;
            case 'view':
            default:
                // #todo - adapt and complete based on retrieved locale from equal (@see packages/core/i18n/.../locale.json)
                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage == 'date' || this.config.usage == 'date/medium' || this.config.usage == 'date/plain.medium') {
                        // 06/08/2023
                        moment_format = 'L';
                    }
                    else if(this.config.usage == 'date/short' || this.config.usage == 'date/plain.short') {
                        // 06/08/23
                        moment_format = (moment.localeData().longDateFormat('L')).replace(/YYYY/g,'YY');
                    }
                    else if(this.config.usage == 'date/plain.short.day') {
                        moment_format = 'dd ' + (moment.localeData().longDateFormat('L')).replace(/YYYY/g,'YY');
                    }
                    else if(this.config.usage == 'month' || this.config.usage.indexOf('date/month') == 0) {
                        moment_format = 'MMM YYYY';
                    }
                }

                // convert date to string, according to locale and usage
                if(this.isValidIsoStringDate(this.value || '')) {
                    value_str = this.formatIsoStringDate(this.value, moment_format);
                }

                // by convention, first column of each row opens the object no matter the type of the field
                if(this.is_first) {
                    this.$elem = $('<div />').addClass('is-first').text(value_str);
                }
                else {
                    this.$elem = UIHelper.createInputView('date_' + this.id, this.label, value_str, this.config.description);
                }
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage||'');
    }

    private autoFormatDateInput(date_str: string, moment_format: string): string {
        const digits = date_str.replace(/\D/g, '');
        const parts = moment_format.split(/[^A-Za-z]/);
        const sep = moment_format.match(/[^A-Za-z]/)?.[0];

        if(!sep || parts.length < 2) {
            return digits;
        }

        let i = 0;
        return parts
            .map(p => digits.slice(i, i += p.length))
            .filter(Boolean)
            .join(sep);
    }

}