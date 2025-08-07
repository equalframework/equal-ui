import Widget from "./Widget";
import { View, Layout } from "../equal-lib";
import SignaturePad from "signature_pad";

export default class WidgetSignature extends Widget {
    private signaturePad: SignaturePad | null = null;

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public render(): JQuery {
        let value:string = this.value ? this.value : '';
        // default content type
        let content_type = 'image/png';
        if (this.config.hasOwnProperty('usage')) {
            const usage = this.config.usage as string;
            // match up to first . (excluded)
            const match = usage.match(/^[^\.]+\/[^\.]+/);
            if(match) {
                // ex: 'image/png'
                content_type = match[0];
            }
        }

        this.$elem = $('<div />').addClass('sb-ui-signature');

        // a signature can never be changed
        if(value.length) {
            this.mode = 'view';
        }

        switch(this.mode) {
            case 'edit':
                let $canvas = $('<canvas />').css({
                        width: '100%',
                        height: '200px',
                        border: '1px solid #ccc',
                        background: '#fff',
                    });

                let $clearButton = $('<button type="button">Effacer</button>').css({ 'margin-top': '8px' });

                this.$elem.append($canvas, $clearButton);

                // deferred init (SignaturePad expects the canvas to be in the final DOM)
                setTimeout(() => this.initSignaturePad(<HTMLCanvasElement> $canvas[0]), 500);

                $clearButton.on('click', () => {
                        console.log('WidgetSignature - clearButton:click');
                        this.signaturePad?.clear();
                        this.value = null;
                        this.$elem.trigger('_updatedWidget', [false]);
                    });

                break;
            case 'view':
                this.$elem.css({
                        'width': '100%',
                        'height': '200px',
                        'background-image': 'url(' + 'data:' + content_type + ';base64,' + value + ')',
                        'background-repeat': 'no-repeat',
                        'background-size': 'contain',
                        'background-position': 'center center'
                    });
            default:
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private initSignaturePad(canvas: HTMLCanvasElement) {
        console.log('WidgetSignature::initSignaturePad', canvas);

        const resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;

            if (width === 0 || height === 0) {
                console.warn('resizeCanvas(): Canvas has zero size, retrying...');
                setTimeout(resizeCanvas, 50);
                return;
            }

            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);

            console.log('WidgetSignature::resizeCanvas - Canvas size:', canvas.offsetWidth, canvas.offsetHeight, '→', canvas.width, canvas.height);
        };

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        this.signaturePad = new SignaturePad(canvas, {
             backgroundColor: 'rgb(255, 255, 255)'
        });

        // restore existing signature, if given
        if(this.value) {
            try {
                const points = JSON.parse(this.value);
                this.signaturePad.fromData(points);
            }
            catch(error) {
                console.warn("SignaturePad: invalid JSON value", error);
            }
        }

        this.signaturePad.addEventListener("endStroke", () => {
            console.log('WidgetSignature:endStroke - received event');
            if(!this.signaturePad!.isEmpty()) {
                this.value = this.getResizedPng(800);
            }
            else {
                this.value = null;
            }
            this.$elem.trigger('_updatedWidget', [false]);
        });
    }

    /**
     * Limit resulting PNG to given resolution.
     *
     */
    private getResizedPng(targetWidth: number): string | null {
        if (!this.signaturePad || this.signaturePad.isEmpty()) {
            return null;
        }

        const originalCanvas = this.signaturePad['_ctx'].canvas;
        const originalWidth = originalCanvas.width;
        const originalHeight = originalCanvas.height;

        if(originalWidth === 0 || originalHeight === 0) {
            return null;
        }

        const scale = targetWidth / originalWidth;
        const targetHeight = Math.round(originalHeight * scale);

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = targetWidth;
        tmpCanvas.height = targetHeight;

        const tmpCtx = tmpCanvas.getContext('2d');
        if(!tmpCtx) {
            return null;
        }

        tmpCtx.fillStyle = "#ffffff";
        tmpCtx.fillRect(0, 0, targetWidth, targetHeight);

        tmpCtx.drawImage(originalCanvas, 0, 0, targetWidth, targetHeight);

        return tmpCanvas.toDataURL('image/png');
    }


}
