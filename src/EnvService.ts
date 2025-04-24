/**
 * This service centralizes environment vars
 */
export class _EnvService {

    private environment:any = null;
    private promise:any = null;

    private default: any = {
        "production":                   true,
        "parent_domain":                "equal.local",
        "backend_url":                  "http://equal.local",
        "rest_api_url":                 "http://equal.local/",
        "lang":                         "en",
        "locale":                       "en",
        "company_name":                 "eQual Framework",
        "company_url":                  "https://equal.run",
        "app_name":                     "eQual.run",
        "app_logo_url":                 "/assets/img/logo.svg",
        "app_settings_root_package":    "core",
        "version":                      "1.0",
        "license":                      "AGPL",
        "license_url":                  "https://www.gnu.org/licenses/agpl-3.0.en.html"
    };

    constructor() {}

    /**
     *
     * @returns Promise
     */
    public getEnv() {
        if(!this.promise) {
            this.promise = new Promise( async (resolve, reject) => {
                try {
                    const response: Response = await fetch('/envinfo');
                    const env = await response.json();
                    this.assignEnv({...this.default, ...env});
                    resolve(this.environment);
                }
                catch(response) {
                    // config.json not found, fallback to default.json
                    this.assignEnv({...this.default});
                    resolve(this.environment);
                }
            });
        }
        return this.promise;
    }

    /**
     * Assign and adapter to support older version of the URL syntax
     */
    private assignEnv(environment: any) {
        if(environment.hasOwnProperty('backend_url')) {
            if(environment.backend_url.replace('://','').indexOf('/') == -1) {
                environment.backend_url += '/';
            }
        }
        this.environment = {...environment};
    }

    public setEnv(property: string, value: any) {
        if(this.environment) {
            this.environment[property] = value;
        }
    }

    /**
     * #memo precision, thousand_sep and decimal_sep must be left empty by default : if not provided values are assigned from envinfo
     *
     * @param value
     * @param precision
     * @param thousand_sep
     * @param decimal_sep
     * @returns
     */
    public formatNumber(value: number, precision: number = -1, thousand_sep: string = '', decimal_sep: string = ''): string {
        if(precision == -1) {
            precision = 0;
            if(this.environment && this.environment.hasOwnProperty('core.locale.numbers.decimal_precision')) {
                precision = this.environment['core.locale.numbers.decimal_precision'];
            }
        }
        if(thousand_sep == '') {
            thousand_sep = ',';
            if(this.environment && this.environment.hasOwnProperty('core.locale.numbers.thousands_separator')) {
                thousand_sep = this.environment['core.locale.numbers.thousands_separator'];
            }
        }
        if(decimal_sep == '') {
            decimal_sep = '.';
            if(this.environment && this.environment.hasOwnProperty('core.locale.numbers.decimal_separator')) {
                decimal_sep = this.environment['core.locale.numbers.decimal_separator'];
            }
        }
        // sanitize received value
        let n = Number(value)
        if(isNaN(n)) {
            n = 0;
        }
        let parts: any = n.toFixed(precision).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousand_sep);
        if(precision > 0 && parts.length == 1) {
            parts[1] = ''.padStart(precision, '0');
        }
        return parts.join(decimal_sep);
    }

    /**
     *
     * #memo thousand_sep and decimal_sp must be left empty by default : subsequent format...() call will assign values according to envinfo
     * @param value
     * @param precision
     * @param thousand_sep
     * @param decimal_sep
     * @returns
     */
    public formatFinancialNumber(value: number, precision: number = 2, thousand_sep: string = '', decimal_sep: string = ''): string {
        if(this.environment && this.environment.hasOwnProperty('core.locale.currency.decimal_precision')) {
            precision = this.environment['core.locale.currency.decimal_precision'];
        }
        return this.formatNumber(value, precision, thousand_sep, decimal_sep);
    }

    /**
     *
     * #memo thousand_sep and decimal_sp must be left empty by default : subsequent format...() call will assign values according to envinfo
     * @param value
     * @param precision
     * @param thousand_sep
     * @param decimal_sep
     * @returns
     */
    public formatCurrency(value: number, precision: number = 2, thousand_sep: string = '', decimal_sep: string = ''): string {
        let result = this.formatFinancialNumber(value, precision, thousand_sep, decimal_sep);
        if(this.environment.hasOwnProperty('core.locale.currency')) {
            if(this.environment.hasOwnProperty('core.locale.currency.symbol_position') && this.environment['core.locale.currency.symbol_position'] == 'before') {
                result = this.environment['core.locale.currency'] + ' ' + result;
            }
            else {
                result = result + ' ' + this.environment['core.locale.currency'];
            }
        }
        else {
            result = '$ ' + value;
        }
        return result;
    }

}


export default _EnvService;