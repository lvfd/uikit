import Scroll from '../mixin/scroll';
import {
    $$,
    css,
    filter,
    data as getData,
    observeIntersection,
    once,
    removeClass,
    removeClasses,
    toggleClass,
    trigger,
} from 'uikit-util';

export default {
    mixins: [Scroll],

    args: 'cls',

    props: {
        cls: String,
        target: String,
        hidden: Boolean,
        margin: String,
        repeat: Boolean,
        delay: Number,
    },

    data: () => ({
        cls: '',
        target: false,
        hidden: true,
        margin: '-1px',
        repeat: false,
        delay: 0,
        inViewClass: 'uk-scrollspy-inview',
    }),

    computed: {
        elements: {
            get({ target }, $el) {
                return target ? $$(target, $el) : [$el];
            },

            watch(elements, prev) {
                if (this.hidden) {
                    // use `opacity:0` instead of `visibility:hidden` to make content focusable with keyboard
                    css(filter(elements, `:not(.${this.inViewClass})`), 'opacity', 0);
                }

                if (prev) {
                    this.$reset();
                }
            },

            immediate: true,
        },
    },

    connected() {
        this._data.elements = new Map();
        this.registerObserver(
            observeIntersection(
                this.elements,
                (records) => {
                    const elements = this._data.elements;
                    for (const { target: el, isIntersecting } of records) {
                        if (!elements.has(el)) {
                            elements.set(el, {
                                cls: getData(el, 'uk-scrollspy-class') || this.cls,
                            });
                        }

                        const state = elements.get(el);
                        if (!this.repeat && state.show) {
                            continue;
                        }

                        state.show = isIntersecting;
                    }

                    this.$emit();
                },
                { rootMargin: this.margin },
                false
            )
        );
    },

    disconnected() {
        for (const [el, state] of this._data.elements.entries()) {
            removeClass(el, this.inViewClass, state?.cls || '');
        }
    },

    update: [
        {
            write(data) {
                for (const [el, state] of data.elements.entries()) {
                    if (state.show && !state.inview && !state.queued) {
                        state.queued = true;

                        data.promise = (data.promise || Promise.resolve())
                            .then(() => new Promise((resolve) => setTimeout(resolve, this.delay)))
                            .then(() => {
                                this.toggle(el, true);
                                setTimeout(() => {
                                    state.queued = false;
                                    this.$emit();
                                }, 300);
                            });
                    } else if (!state.show && state.inview && !state.queued && this.repeat) {
                        this.toggle(el, false);
                    }
                }
            },
        },
    ],

    methods: {
        toggle(el, inview) {
            const state = this._data.elements.get(el);

            if (!state) {
                return;
            }

            state.off?.();

            css(el, 'opacity', !inview && this.hidden ? 0 : '');

            toggleClass(el, this.inViewClass, inview);
            toggleClass(el, state.cls);

            if (/\buk-animation-/.test(state.cls)) {
                const removeAnimationClasses = () => removeClasses(el, 'uk-animation-[\\w-]+');
                if (inview) {
                    state.off = once(el, 'animationcancel animationend', removeAnimationClasses);
                } else {
                    removeAnimationClasses();
                }
            }

            trigger(el, inview ? 'inview' : 'outview');

            state.inview = inview;

            // change to `visibility: hidden` does not trigger observers
            this.$update(el);
        },
    },
};
