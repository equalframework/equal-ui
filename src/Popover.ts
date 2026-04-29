import { $ } from "./jquery-lib";

export interface PopoverOptions {
    title: string;
    body: JQuery;
    clipboardValue?: any;
    externalLink?: string;
    group?: string;
    openDelay?: number;
    closeDelay?: number;
    popupClass?: string;
}

export default class Popover {

    private static instances: Popover[] = [];

    private $anchor: JQuery;
    private $popup: JQuery;
    private $title: JQuery;
    private $body: JQuery;
    private group: string;
    private openDelay: number;
    private closeDelay: number;
    private eventNamespace: string;
    private openTimer: any = null;
    private closeTimer: any = null;
    private clipboardValue: any;
    private externalLink: string;

    /**
     * Example:
     *   new Popover($anchor, {
     *      title: 'View details',
     *      body: $body,
     *      clipboardValue: 'core\\User.form.default',
     *      externalLink: '/?get=...',
     *      group: 'breadcrumb-details',
     *      openDelay: 1200,
     *      closeDelay: 500,
     *      popupClass: 'header-view-details-popup'
     *  });
     */
    constructor($anchor: JQuery, options: PopoverOptions) {
        console.debug('Popover::constructor', options);
        this.$anchor = $anchor;
        this.eventNamespace = '.popover_' + Math.random().toString(36).substring(2, 10);
        this.group = options.group ?? '';
        this.openDelay = options.openDelay ?? 0;
        this.closeDelay = options.closeDelay ?? 0;
        this.clipboardValue = options.clipboardValue;
        this.externalLink = options.externalLink ?? '';

        const $actions = $('<div />').addClass('sb-popover-actions');

        if(this.hasTextValue(this.clipboardValue)) {
            $actions.append(
                $('<span class="material-icons">content_copy</span>')
                    .addClass('sb-popover-copy btn-copy')
                    .attr('title', 'Copy')
                    .on('click', async (event: any) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await this.copyToClipboard();
                    })
            );
        }

        if(this.hasTextValue(this.externalLink)) {
            $actions.append(
                $('<span class="material-icons">open_in_new</span>')
                    .addClass('sb-popover-open-link')
                    .attr('title', 'Open in new tab')
                    .on('click', (event: any) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.open(this.externalLink, '_blank', 'noopener,noreferrer');
                    })
            );
        }

        this.$title = $('<div />')
            .addClass('sb-popover-title')
            .append(
                $('<span />')
                    .addClass('sb-popover-title-text')
                    .text(options.title)
            );

        if($actions.children().length) {
            this.$title.append($actions);
        }

        this.$body = $('<div />')
            .addClass('sb-popover-body')
            .append(options.body);

        this.$popup = $('<div />')
            .addClass('sb-popover')
            .hide()
            .append(this.$title)
            .append(this.$body);

        if(options.popupClass) {
            this.$popup.addClass(options.popupClass);
        }

        this.$popup.data('popover-instance', this);
        Popover.instances.push(this);

        this.bind();
        this.$popup.appendTo(this.$anchor);
    }

    public static destroyGroup(group: string) {
        for(const instance of [...Popover.instances]) {
            if(instance.group === group) {
                instance.destroy();
            }
        }
    }

    public destroy() {
        this.clearTimers();
        this.$anchor.off(this.eventNamespace).removeClass('has-mouseover');
        this.$popup.off(this.eventNamespace).removeData('popover-instance').removeClass('has-mouseover').remove();
        Popover.instances = Popover.instances.filter((instance) => instance !== this);
    }

    public getPopup() {
        return this.$popup;
    }

    private bind() {
        this.$anchor
            .on('mouseenter' + this.eventNamespace, () => {
                this.clearCloseTimer();
                this.$anchor.addClass('has-mouseover');
                Popover.hideGroup(this.group, this);
                this.openTimer = setTimeout(() => {
                    if(this.$anchor.hasClass('has-mouseover')) {
                        this.show();
                    }
                }, this.openDelay);
            })
            .on('mouseleave' + this.eventNamespace, () => {
                this.clearOpenTimer();
                this.$anchor.removeClass('has-mouseover');
                this.scheduleHide();
            });

        this.$popup
            .on('mouseenter' + this.eventNamespace, () => {
                this.clearCloseTimer();
                this.$popup.addClass('has-mouseover');
            })
            .on('mouseleave' + this.eventNamespace, () => {
                this.$popup.removeClass('has-mouseover');
                this.scheduleHide();
            });
    }

    private static hideGroup(group: string, except?: Popover) {
        if(!group.length) {
            return;
        }
        for(const instance of Popover.instances) {
            if(instance !== except && instance.group === group) {
                instance.hide();
            }
        }
    }

    private show() {
        if(!this.isAnchorInDom()) {
            return;
        }

        const offset = this.$anchor.offset();
        const height = this.$anchor.outerHeight() ?? 0;

        this.$popup
            .appendTo('body')
            .css({
                position: 'fixed',
                top: (offset?.top ?? 0) + height,
                left: offset?.left ?? 0,
            })
            .show();
    }

    private hide() {
        this.clearTimers();
        this.$anchor.removeClass('has-mouseover');
        this.$popup.removeClass('has-mouseover');

        if(!this.isAnchorInDom()) {
            this.$popup.remove();
            return;
        }

        this.$popup.hide().appendTo(this.$anchor);
    }

    private scheduleHide() {
        this.clearCloseTimer();
        this.closeTimer = setTimeout(() => {
            if(!this.$anchor.hasClass('has-mouseover') && !this.$popup.hasClass('has-mouseover')) {
                this.hide();
            }
        }, this.closeDelay);
    }

    private async copyToClipboard() {
        const value = String(this.clipboardValue ?? '');

        if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(value);
                console.debug('Popover::copyToClipboard copied from navigator.clipboard');
                return;
            }
            catch(error) {
                console.debug('Popover::copyToClipboard fallback to execCommand', error);
            }
        }

        // fallback for old browsers
        const tmp = document.createElement('textarea');
        tmp.style.position = 'absolute';
        tmp.style.left = '-9999px';
        tmp.value = value;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
        console.debug('Popover::copyToClipboard copied with document.execCommand');
    }

    private hasTextValue(value: any) {
        if(value === null || typeof value === 'undefined') {
            return false;
        }
        return String(value).trim().length > 0;
    }

    private isAnchorInDom() {
        return this.$anchor.closest('body').length > 0;
    }

    private clearTimers() {
        this.clearOpenTimer();
        this.clearCloseTimer();
    }

    private clearOpenTimer() {
        if(this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
        }
    }

    private clearCloseTimer() {
        if(this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    }
}
