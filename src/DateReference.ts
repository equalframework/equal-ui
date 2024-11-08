/**
 * Class for Date descriptors parsing
 *
 *

    ## date parser

    * either an ISO string
    * either a description with a format relating to NOW

    Result of the parsing is always a date.


    Syntax:
    date.[this|prev|next].[day|week|month|quarter|semester|year].[first|last]


    * today = date.this.day

    * first day of current year = date.this.year.first

    * last day of last week = date.prev.week.last

 *
 */
export class DateReference {

    private date: Date;

    constructor(descriptor:string) {
        this.date = new Date();
        this.parse(descriptor);
    }


    /**
     *
     * descriptor syntax: date.[this|prev|next].[day|week|month|quarter|semester|year].[first|last]
     * #todo - this must be improved to comply with the PHP logic
     * @param descriptor
     */
    public parse(descriptor:string) {
        let date = new Date(descriptor);
        if(!descriptor || !isNaN(date.getMonth())) {
            this.date = date;
        }
        else {
            // init date at today at midnight UTC
            date = new Date();
            date.setUTCHours(0, 0, 0, 0);
            descriptor = descriptor.toLowerCase();
            if(descriptor.indexOf('date.') == 0) {
                let parts = descriptor.split('.');
                let len = parts.length;
                if(len > 2) {
                    let offset = (parts[1].indexOf('prev') === 0) ? -1 : ((parts[1].indexOf('next') === 0) ? 1 : 0);
                    let day = (len >= 4 && parts[3].indexOf('last') === 0) ? 'last' : 'first';

                    switch(parts[2]) {
                        case 'day':
                            this.date = new Date(date);
                            this.date.setDate(date.getDate() + offset);
                            break;
                        case 'week':
                            this.date = new Date(date);
                            let dow = date.getDay(), diff = -dow + (dow == 0 ? -6:1);
                            this.date.setDate(date.getDate() + diff + offset * 7);
                            if(day == 'last') {
                                this.date.setDate(this.date.getDate() + 6);
                            }
                            break;
                        case 'month':
                            this.date = new Date(date.getFullYear(), date.getMonth() + offset, 1);
                            if(day == 'last') {
                                this.date = new Date(date.getFullYear(), date.getMonth() + offset + 1, 0);
                            }
                            break;
                        case 'quarter':
                            break;
                        case 'semester':
                            break;
                        case 'year':
                            this.date = new Date(date.getFullYear() + offset, 0, 1);
                            if(day == 'last') {
		                        this.date = new Date(date.getFullYear() + offset, 11, 31);
                            }
                            break;
                    }
                    // remove TZ offset (date is given as UTC)
                    let timestamp = this.date.getTime();
                    let offset_tz = this.date.getTimezoneOffset()*60*1000;
                    this.date = new Date(timestamp-offset_tz);
                }
            }
        }
    }

    public getDate()  {
        return this.date;
    }


}

export default DateReference;

/*

if(strpos('date.month'))

if(strpos('date.year'))
	if date.year.first_day
		var firstDay = new Date(date.getFullYear(), 0, 1);
	if date.year.last_day
		var lastDay = new Date(date.getFullYear(), 11, 31);

	else new Date().getFullYear();


if(strpos(date.week))
    d = new Date();
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);


if(date.dow)
	var e = ((new Date()).getDay() + 6) % 7 + 1;

if(date.now)
	new Date();
*/