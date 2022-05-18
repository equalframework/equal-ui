/**
 * Class for Date descriptors parsing
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
     * @param descriptor
     */
    public parse(descriptor:string) {
        let date = new Date(descriptor);
        if(!descriptor || !isNaN(date.getMonth())) {
            this.date = date;
        }
        else {
            // init at today
            date = new Date();
            descriptor = descriptor.toLowerCase();
            if(descriptor.indexOf('date.') == 0) {
                let parts = descriptor.split('.');
                let len = parts.length;
                if(len > 2) {
                    let offset = (parts[1] == 'prev')? -1 : ((parts[1] == 'next')? 1 : 0);
                    let day = (len >= 4 && parts[3] == 'last')?'last':'first';

                    switch(parts[2]) {
                        case 'day':
                            this.date = new Date(date);
                            this.date.setDate(date.getDate() + offset);
                            break;
                        case 'week':
                            this.date = new Date(date);
                            let dow = date.getDay(), diff = date.getDate() - dow + (dow == 0 ? -6:1); // adjust sunday
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