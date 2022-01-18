
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(["jquery"], factory);
    } else if (typeof exports === "object") {
        module.exports = factory(require("jquery"));
    } else {
        factory(root.jQuery);
    }
}(this, function ($) { 

	//overriding functions meant to be private (starting with an underscore)
	$.datepicker._updateDatepicker_orig = $.datepicker._updateDatepicker;
	$.datepicker._doKeyDown_orig = $.datepicker._doKeyDown;
	$.datepicker._newInst_orig = $.datepicker._newInst;    
    $.datepicker._getDateDatepicker_orig = $.datepicker._getDateDatepicker;
	
	$.extend($.datepicker, {
        
        _newInst: function( target, inline ) {
            var inst = this._newInst_orig(target, inline);

            // inject additional default values
            var today = new Date();
            inst.settings = $.extend( {}, inst.settings, {
                datetime: false,
                twentyFour: false,
                showSeconds: false
            } );
            this.setHours(inst, today.getHours());
            this.setMinutes(inst, today.getMinutes());
            this.setSeconds(inst, 0);
            
            return inst;
        },
        
		_doKeyDown: function(event) {
			var inst = $.datepicker._getInst(event.target);
			var handled = true;
			//var isRTL = inst.dpDiv.is('.ui-datepicker-rtl');
			inst._keyEvent = true;
			if ($.datepicker._datepickerShowing) {
				switch (event.keyCode) {
					case 27:
                        if($('.ui-datepicker-select-month').is(':visible')) {
                            $.datepicker._updateDatepicker(inst);
                        }
                        else if($('.ui-datepicker-select-year').is(':visible')) {
                            $.datepicker._toggleDisplay('#'+inst.id, 2, this);
                        }
                        else {
                            // hide on esc
                            $.datepicker._hideDatepicker();
                        }
                        break; 
					default:
                        //call the original function
                        $.datepicker._doKeyDown_orig(event);
				}
			}
			else {
				//call the original function
				$.datepicker._doKeyDown_orig(event);
			}
		},
        
        _setDateTimeDatepicker:  function(target, date) {
            var inst = $.datepicker._getInst(target);
            this._setDateDatepicker(target, date);
            this.setHours(inst, date.getHours());
            this.setMinutes(inst, date.getMinutes());
            this.setSeconds(inst, date.getSeconds());
            this.setText(inst);
        },

        _getDateDatepicker: function( target, noDefault ) {
            var date = this._getDateDatepicker_orig( target, noDefault );
            var inst = $.datepicker._getInst(target); 
			
            if(!date) {
				date = new Date();
			}
			if(inst) {
				date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), inst.selectedHour, inst.selectedMin, inst.selectedSec);
			}            

            return date;
        },

		_updateDatepicker: function(inst) {
			//call the original function
			this._updateDatepicker_orig(inst);

			//TODO: multiMonth
			var numMonths = this._getNumberOfMonths(inst);
			var isMultiMonth = (numMonths[0] != 1 || numMonths[1] != 1);
			var changeMonth = this._get(inst, 'changeMonth');
			var changeYear = this._get(inst, 'changeYear');
			if(isMultiMonth || changeMonth || changeYear) {
				return ;
			}

			var uidptitle = inst.dpDiv.find('.ui-datepicker-title');

			inst.dpDiv.append(this._generateMonthYearPicker(inst));
            
            if(inst.settings.datetime) {
                var time_button = $('<button class="mdc-button mdc-button--raised"><span class="material-icons mdc-fab__icon">access_time</span></button>');
                uidptitle.parent().append($('<div />').addClass('ui-datepicker-header-time-switch').append(time_button));
                
                time_button.on('click', function() {
                    $.datepicker._toggleDisplay('#' + inst.id, 4); return false;
                });
                
                inst.dpDiv.append(this._generateTimePicker(inst));
                this.setText(inst);                
            }
            
			var uidptitle_link = uidptitle.wrapInner('<a href="#"/>');
			uidptitle_link.on('click', function(){$.datepicker._toggleDisplay('#' + inst.id, 2); return false;});
            
		},

		//focus the date input field
		_instInputFocus_MYP: function(inst) {
			//code copied from datePicker's _updateDatepicker()
			if (inst == $.datepicker._curInst && $.datepicker._datepickerShowing && inst.input &&
					// #6694 - don't focus the input if it's already focused
					// this breaks the change event in IE
					inst.input.is(':visible') && !inst.input.is(':disabled') && inst.input[0] != document.activeElement)
				inst.input.focus();

		},

		_generateMonthPickerHTML_MonthYearPicker: function(inst, minDate, maxDate, drawMonth, inMinYear, inMaxYear) {
			//TODO RTL?
			var monthNamesShort = this._get(inst, 'monthNamesShort');

			var monthPicker = '<table><tbody><tr>';

			var unselectable = false;
			for (var month = 0; month < 12; ) {
				unselectable = 	(inMinYear && month < minDate.getMonth()) ||
												(inMaxYear && month > maxDate.getMonth());
				monthPicker += '<td class="' +
					(unselectable ? ' ' + this._unselectableClass + ' ui-state-disabled': '') +  // highlight unselectable months
					(month == drawMonth ? ' ui-datepicker-today' : '') + '"' +
					(unselectable ? '' : ' onclick="$.datepicker._pickMonthYear_MonthYearPicker(\'#' + inst.id + '\', ' + month + ', \'M\');return false;"') + '>' + // actions
					((unselectable ? '<span class="ui-state-default">' + monthNamesShort[month] + '</span>' : '<a class="ui-state-default ' +
					//(month == drawMonth ? ' ui-state-highlight' : '') +
					(month == drawMonth ? ' ui-state-active' : '') + // highlight selected day
					//(otherMonth ? ' ui-priority-secondary' : '') + // distinguish dates from other months
					'" href="#">' + monthNamesShort[month] + '</a>')) + '</td>'; // display selectable date

				if(++month % 4 === 0) {
					monthPicker += '</tr>';
					if(month != 12) {
						monthPicker += '<tr>';
					}
				}
			}
			monthPicker += '</tbody></table>';

			return monthPicker;
		},

        _incrementTime: function(inst, targetClass, operator) {
            if (targetClass.endsWith('hours')) {
                this.setHours(inst, eval(this.getHours(inst) + operator + '1'));
            } 
            else if (targetClass.endsWith('minutes')) {
                this.setMinutes(inst, eval(this.getMinutes(inst) + operator + '1'));
            } 
            else if (targetClass.endsWith('seconds')) {
                this.setSeconds(inst, eval(this.getSeconds(inst) + operator + '1'));
            } 
            else {
                this.setMeridiem(inst);
            }
            this.setText(inst);
            if(inst.input && inst.input.hasClass('hasDatepicker')) {
                inst.input.change();
            }            
        },
        
        setText: function (inst) {
            $(inst.dpDiv).find('.timepicker__controls__control--hours').text( this.getHours(inst).toString().padStart(2, '0') );
            $(inst.dpDiv).find('.timepicker__controls__control--minutes').text( this.getMinutes(inst).toString().padStart(2, '0') );
            $(inst.dpDiv).find('.timepicker__controls__control--seconds').text( this.getSeconds(inst).toString().padStart(2, '0') );
            $(inst.dpDiv).find('.timepicker__controls__control--meridiem').text( this.getMeridiem(inst) );
        },
        
        setHours: function (inst, hours) {
            if(inst.settings.twentyFour) {
                if(hours > 23) hours = 0;
                if(hours < 0) hours = 23;
            }
            else{
                if(hours > 11) {
                    hours = hours % 12;
                    inst.selectedMeridiem = 'PM';
                }
                if(hours < 0) hours = 11;
            }
            inst.selectedHour = hours;
        },
        
        setMinutes: function (inst, minutes) {
            if(minutes > 59) minutes = minutes % 60;
            if(minutes < 0) minutes = 59;
            
            inst.selectedMin = minutes;
        },
        
        setSeconds: function (inst, seconds) {
            inst.selectedSec = seconds;
        },

        setMeridiem: function (inst) {
            var inputMeridiem = 'AM';
            if(inst.selectedMeridiem == 'AM') {
                inputMeridiem = 'PM';
            }
            inst.selectedMeridiem = inputMeridiem;
        },

        getHours: function (inst) {
            return inst.selectedHour;
        },

        getMinutes: function (inst) {
            return inst.selectedMin;        
        },

        getSeconds: function (inst) {
            return inst.selectedSec;
        },

        getMeridiem: function (inst) {
            return inst.selectedMeridiem;
        },
      

		_generateTimePicker: function(inst) {
            var $elem = $('<div />').addClass('ui-datepicker-select-time').hide();            
            
            var picker = '<div class="timepicker"><ul class="timepicker__controls"><li class="timepicker__controls__control"><span class="timepicker__controls__control-up"></span><span class="timepicker__controls__control--hours" tabindex="-1">00</span><span class="timepicker__controls__control-down"></span></li><li class="timepicker__controls__control--separator"><span class="timepicker__controls__control--separator-inner">:</span></li><li class="timepicker__controls__control"><span class="timepicker__controls__control-up"></span><span class="timepicker__controls__control--minutes" tabindex="-1">00</span><span class="timepicker__controls__control-down"></span></li>';
            if (inst.settings.showSeconds) {
                picker += '<li class="timepicker__controls__control--separator"><span class="timepicker__controls__control--separator-inner">:</span></li><li class="timepicker__controls__control"><span class="timepicker__controls__control-up"></span><span class="timepicker__controls__control--seconds" tabindex="-1">00</span><span class="timepicker__controls__control-down"></span> </li>';
            }
            if (!inst.settings.twentyFour) {
                picker += '<li class="timepicker__controls__control"><span class="timepicker__controls__control-up"></span><span class="timepicker__controls__control--meridiem" tabindex="-1">AM</span><span class="timepicker__controls__control-down"></span></li></ul></div>';
            }
  
            var $picker = $(picker);

            var self = this;
            
            var timeOut = null;
            $picker.find('.timepicker__controls__control-up').add($picker.find('.timepicker__controls__control-down'))
            .on('mousedown touchstart', function (event) {
                var operator = (this.className.indexOf('up') > -1) ? '+' : '-';               
                var $next = $(this.nextSibling);
                var $prev = $(this.previousSibling);
                var $target = (operator === '+') ? $next : $prev;
                var targetClass = $target.attr('class');
                timeOut = setInterval(function () {
                    self._incrementTime(inst, targetClass, operator);                    
                }, 200);
                return false;
            })
            .on('mouseup touchend mouseout', function () {
                clearInterval(timeOut);
                return false;
            })
            .on('click', function () {
                var operator = (this.className.indexOf('up') > -1) ? '+' : '-';               
                var $next = $(this.nextSibling);
                var $prev = $(this.previousSibling);
                var $target = (operator === '+') ? $next : $prev;
                var targetClass = $target.attr('class');                

                self._incrementTime(inst, targetClass, operator);
                return false;
            });
               
            $elem.append($picker);
            return $elem;
        },
        
		_generateMonthYearPicker: function(inst) {
			var minDate = this._getMinMaxDate(inst, 'min');
			var maxDate = this._getMinMaxDate(inst, 'max');
			var drawYear = inst.drawYear;
			var drawMonth = inst.drawMonth;
			var inMinYear = (minDate && minDate.getFullYear() == drawYear);
			var inMaxYear = (maxDate && maxDate.getFullYear() == drawYear);

			var monthPicker = this._generateMonthPickerHTML_MonthYearPicker(inst, minDate, maxDate, drawMonth, inMinYear, inMaxYear);

			return $('<div class="ui-datepicker-select-month" style="display: none">' + monthPicker + '</div>' +
				'<div class="ui-datepicker-select-year" style="display: none"></div>');	//yearPicker gets filled dinamically
		},

		_pickMonthYear_MonthYearPicker: function(id, valueMY, period) {
            var target = $( id ), inst = this._getInst( target[ 0 ] );
            // keep track of the current drawYear (will be erased by next call)
            var drawYear = inst.drawYear;
            
			var dummySelect = $('<select/>').append( new Option(valueMY, valueMY, true, true) );
			//select month/year and show datepicker
			this._selectMonthYear(id, dummySelect[0], period);

            // if a month has been selected, select tht displayed date as well
			if(period == 'M') {                               
                dummySelect = $('<select/>').append( new Option(drawYear, drawYear, true, true) );
                this._selectMonthYear(id, dummySelect[0], 'Y');
            }         

            // if we selected a year, force display of the monthpicker
			if(period == 'Y') {
				this._toggleDisplay(id, 2);
			}
		},



		_addHoverEvents_MonthYearPicker: function (parent) {
			var dpMonths = parent.find('.ui-state-default');
			dpMonths.hover(
				function () {
					$(this).addClass('ui-state-hover');
				},
				function () {
					$(this).removeClass("ui-state-hover");
				});
		},

		_toggleDisplay: function(id, screen, input) {

            var target = $(id);
            var inst = this._getInst(target[0]);

			if (this._isDisabledDatepicker(target[0])) {
				return;
			}
			//keep the focus for _doKeyDown to work
			this._instInputFocus_MYP(inst);

			var minDate = this._getMinMaxDate(inst, 'min');
			var maxDate = this._getMinMaxDate(inst, 'max');
			var drawYear = inst.drawYear;	//inst.drawYear = inst.selectedYear = inst.currentYear
			var drawMonth = inst.drawMonth;
			var minYear = minDate ? minDate.getFullYear() : 0; //TODO
			var maxYear = maxDate ? maxDate.getFullYear() : undefined;
			var dpHeader = inst.dpDiv.children('.ui-datepicker-header');
			var dpPrev = dpHeader.children('a.ui-datepicker-prev');
			var dpNext = dpHeader.children('a.ui-datepicker-next');
			var dpTitle = dpHeader.children('.ui-datepicker-title');

			var self = this;

			switch (screen) {
				case 2:
					//month picker
					var inMinYear = (minYear !== undefined && minYear == drawYear);
					var inMaxYear = (maxYear !== undefined && maxYear == drawYear);
					var _advanceYear_MYP = function(diff) {
						drawYear += diff;
                        inst.drawYear = drawYear;
						dpTitle.children(':first').text(drawYear);
						//update screen
						if(minDate || maxDate) {
							inMinYear = minYear == drawYear;
							inMaxYear = maxYear == drawYear;
							//update month selection
							var monthPicker = self._generateMonthPickerHTML_MonthYearPicker(inst, minDate, maxDate, drawMonth, inMinYear, inMaxYear);
							inst.dpDiv.children('.ui-datepicker-select-month').html(monthPicker);
						}
						_updatePrevNextYear_MYP();
					};
					var _updatePrevNextYear_MYP = function() {
						dpPrev.unbind('click');
						if(!inMinYear) {
							dpPrev.removeClass('ui-state-disabled').on('click', function() {
                                _advanceYear_MYP(-1); 
                                self._instInputFocus_MYP(inst);
                            });
						}
						else {
							dpPrev.addClass('ui-state-disabled');
						}
						dpNext.unbind('click');
						if(!inMaxYear) {
							dpNext.removeClass('ui-state-disabled').on('click', function() {
                                _advanceYear_MYP(1); 
                                self._instInputFocus_MYP(inst);
                            });
						}
						else {
							dpNext.addClass('ui-state-disabled');
						}
					};
					//change title link behaviour
					dpTitle.html('<a href="#" class="ui-datepicker-yearpicker" onclick="$.datepicker._toggleDisplay(\'#' + inst.id + '\', 3);return false;">' + drawYear +'</a>');
					// update prev next behaviour
					dpPrev.off('click').removeAttr('onclick');  
					dpNext.off('click').removeAttr('onclick');
					_updatePrevNextYear_MYP();

					var dpMonthSelector = inst.dpDiv.find('.ui-datepicker-select-month table');
					this._addHoverEvents_MonthYearPicker(dpMonthSelector);

					inst.dpDiv.find('table.ui-datepicker-calendar').hide();
                    inst.dpDiv.find('.ui-datepicker-select-time').hide();
					inst.dpDiv.find('.ui-datepicker-select-year').hide();                                        
					inst.dpDiv.find('.ui-datepicker-select-month').show();



					break;
				case 3:
					//year picker
					var year = parseInt(drawYear/10, 10) * 10;  //first year in this decade
					//change title link behaviour
					dpTitle.unbind('click');
					//change prev next behaviour
					$.backToActualMonth = function() {
						//var d = new Date();
						//var month = d.getMonth()+1;
						$.datepicker._pickMonthYear_MonthYearPicker('#'+inst.id, drawMonth, 'M');
						return false;
					};
					var _updateYearPicker_MYP = function(year) {
						//TODO RTL
						//change title html
                        dpTitle.html('<a class="ui-datepicker-title" '+
						'onclick="return $.backToActualMonth();" '+
					    'href="#">'+ year + '-' + (year + 9) + '</a>');
						//change prev next behaviour
						dpPrev.unbind('click');
						dpNext.unbind('click');
						if(year > minYear) {
							dpPrev.removeClass('ui-state-disabled').on('click', function() {
                                _updateYearPicker_MYP(year-21); self._instInputFocus_MYP(inst);
                            });
						}
						else {
							dpPrev.addClass('ui-state-disabled');
						}
						if(maxYear === undefined || year+9 < maxYear) {
							dpNext.removeClass('ui-state-disabled').on('click', function() {
                                _updateYearPicker_MYP(year-1); self._instInputFocus_MYP(inst);
                            });
						}
						else {
							dpNext.addClass('ui-state-disabled');
						}

						//generate year picker HTML
						var yearPicker = '<table><tbody><tr>';
						//show years in 4x3 matrix 
						year--; //last year of the previous decade
						for (var i = 1; i <= 12; i++) {
							unselectable = (minYear !== 'undefined' && year < minYear) ||
								(maxYear !== 'undefined' && year > maxYear);
							//html += '<span class="year'+(i == -1 || i == 10 ? ' old' : '')+(currentYear == year ? ' active' : '')+'">'+year+'</span>';
							yearPicker += '<td class="' +
								(unselectable ? ' ' + this._unselectableClass + ' ui-state-disabled': '') +  // highlight unselectable months
								((!unselectable && (i==1 || i==12)) ? ' outoffocus' : '') +
								(year == drawYear ? ' ui-datepicker-today' : '') + '"' +
								(unselectable ? '' : ' onclick="$.datepicker._pickMonthYear_MonthYearPicker(\'#' + inst.id + '\', ' + year + ', \'Y\');return false;"') + '>' + // actions
								((unselectable ? '<span class="ui-state-default">' + year + '</span>' : '<a class="ui-state-default ' +
								//(month == drawMonth ? ' ui-state-highlight' : '') +
								(year == drawYear ? ' ui-state-active' : '') + // highlight selected day
								//(otherMonth ? ' ui-priority-secondary' : '') + // distinguish dates from other months
								'" href="#">' + year + '</a>')) + '</td>'; // display selectable date
							if(i % 4 == 0) {
								yearPicker += '</tr>';
								if(i != 12) {
									yearPicker += '<tr>';
								}
							}
							year++;
						}
						yearPicker += '</tbody></table>';
						$('.ui-datepicker-select-year').html(yearPicker);
					};

					_updateYearPicker_MYP(year);

					var dpYearSelector = inst.dpDiv.find('.ui-datepicker-select-year table');
					this._addHoverEvents_MonthYearPicker(dpYearSelector);

					inst.dpDiv.find('table.ui-datepicker-calendar').hide();
					inst.dpDiv.find('.ui-datepicker-select-month').hide();
					inst.dpDiv.find('.ui-datepicker-select-time').hide();                    
					inst.dpDiv.find('.ui-datepicker-select-year').show();

					
					break;
                case 4:

					inst.dpDiv.find('table.ui-datepicker-calendar').hide();
					inst.dpDiv.find('.ui-datepicker-select-month').hide();
					inst.dpDiv.find('.ui-datepicker-select-year').hide();                    
					inst.dpDiv.find('.ui-datepicker-select-time').show();
                    
                    break;
			}

		}

	});


}));