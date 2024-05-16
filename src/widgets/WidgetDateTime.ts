import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDateTime extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'date', label, value, config);
    }

    private jqueryToMomentFormat(format: string): string {
        let result:string = format;
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
     * Converts a date from jquery-ui format (dateFormat) to ISO string according to provided format.
     * Uses moment.js for the formatting.
     *
     * @param date
     * @param format
     */
    private adaptFromDateFormat(date: Date, format: string): string {
        console.debug('WidgetDateTime::adaptFromDateFormat', date, format);
        let res = moment(date).format(this.jqueryToMomentFormat(format));
        return res;
    }

    public change(value: any) {
        console.debug('WidgetDateTime::change', value);
        let $datepicker = this.$elem.find('.datepicker');
        let format = $datepicker.datepicker('option', 'dateFormat') + ' ' + $datepicker.datepicker('option', 'timeFormat');
        let date = new Date();
        if(value && value.length) {
            date = new Date(value);
        }
        let str_date = this.adaptFromDateFormat(date, format);
        this.$elem.find('.datepicker').datepicker('setDateTime', date);
        this.$elem.find('input').first().val((value && value.length)?str_date:'');
    }

    public render(): JQuery {
        let date = new Date();
        if(this.value && this.value.length) {
            date = new Date(this.value);
        }
        let value:any;
        let format: string;

        switch(this.mode) {
            case 'edit':
                let $datetimepicker = $('<input type="text" />').addClass('datepicker sb-widget-datetime-datepicker');

                let datepickerConfig = {
                        datetime: true,
                        twentyFour: true,
                        showSeconds: false,
                        autoOpen: false,
                        ...jqlocale[this.getLayout().getEnv().locale],
                        onClose: () => {
                            let newDate = $datetimepicker.datepicker('getDate');
                            let str_date: string = <string> this.$elem.find('input').first().val();
                            if(date.getTime() != newDate.getTime() && str_date.length > 0) {
                                this.value = newDate.toISOString();
                                this.$elem.trigger('_updatedWidget');
                                // give the focus back once the widget will have been refreshed
                                // #memo - this is done in layout
                                /*
                                setTimeout( () => {
                                    $('#'+this.getId()).find('input').first().trigger('focus');
                                }, 250);
                                */
                            }
                        }
                    };

                // #memo - in some cases datepicker fails to parse the date with applied format, and falls back to defaultDate
                datepickerConfig.defaultDate = date;

                format = datepickerConfig.dateFormat + ' ' + datepickerConfig.timeFormat;
                value = (this.value)?this.adaptFromDateFormat(date, format):'';

                this.$elem = UIHelper.createInput('date_'+this.id, this.label, value, this.config.description, '', this.readonly);

                let $input = this.$elem.find('input').first()
                    .on('keypress', (event:any) => {
                        if (event.which == 9) {
                            // #todo: force focus to the next input
                            event.preventDefault();
                        }
                    })
                    .on('change', (event) => {
                        let $this = $(event.currentTarget);
                        let date = new Date();
                        let mdate = moment($this.val(), this.jqueryToMomentFormat(format), true);
                        if(mdate.isValid()) {
                            date = mdate.toDate();
                        }
                        else {
                            console.debug('WidgetDateTime:invalid date format detected');
                        }
                        this.value = date.toISOString();
                        $datetimepicker.datepicker('setDateTime', date);
                    });

                let $button_open = UIHelper.createButton('datetime-actions-open_'+this.id, '', 'icon', 'calendar_today')
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
                    .on('change', (event:any) => {
                        // update widget value using jQuery `getDate`
                        let $this = $(event.currentTarget);
                        let newDate = $this.datepicker('getDate');
                        console.debug('WidgetDateTime::datetimepicker change', newDate);
                        // $elem.trigger('_updatedWidget', date.toISOString());
                        this.$elem.find('input').first().val(this.adaptFromDateFormat(newDate, format));
                    });

                $datetimepicker.datepicker('setDateTime', date);

                this.$elem.append($datetimepicker);

                break;
            case 'view':
            default:
                format = 'LLL';
                if(this.config.hasOwnProperty('usage')) {
                    if(this.config.usage == 'datetime/short' || this.config.usage == 'date/time.short') {
                        // 06/08/23
                        format = (moment.localeData().longDateFormat('L') + ' ' + moment.localeData().longDateFormat('LT')).replace(/YYYY/g,'YY');
                    }
                    else if(this.config.usage == 'datetime/full' || this.config.usage == 'date/time.full') {
                        format = 'LLLL';
                    }
                    else if(this.config.usage == 'date' || this.config.usage == 'date/medium' || this.config.usage == 'date/plain.medium' || this.config.usage == 'date/time.medium') {
                        // 06/08/2023
                        format = 'L';
                    }
                    else if(this.config.usage == 'time' || this.config.usage == 'time/plain') {
                        format = 'HH:mm';
                    }
                }

                // convert datetime to string, according to locale and usage
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

        return this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}