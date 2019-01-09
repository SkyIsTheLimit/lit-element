
/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {LitElement} from '../lit-element.js';

import {PropertyDeclaration, UpdatingElement} from './updating-element.js';

export type Constructor<T> = {
  new (...args: any[]): T
};

/**
 * Class decorator factory that defines the decorated class as a custom element.
 *
 * @param tagName the name of the custom element to define
 *
 * In TypeScript, the `tagName` passed to `customElement` should be a key of the
 * `HTMLElementTagNameMap` interface. To add your element to the interface,
 * declare the interface in this module:
 *
 *     @customElement('my-element')
 *     export class MyElement extends LitElement {}
 *
 *     declare global {
 *       interface HTMLElementTagNameMap {
 *         'my-element': MyElement;
 *       }
 *     }
 *
 */
export const customElement = (tagName: string) =>
    (classOrDescriptor: Constructor<HTMLElement>|ClassDescriptor) => {
      if (typeof classOrDescriptor === 'function') {
        const clazz = classOrDescriptor as Constructor<HTMLElement>;
        // Legacy decorator
        window.customElements.define(tagName, clazz);
        // Cast as any because TS doesn't recognize the return type as being a
        // subtype of the decorated class when clazz is typed as
        // `Constructor<HTMLElement>` for some reason.
        // `Constructor<HTMLElement>` is helpful to make sure the decorator is
        // applied to elements however.
        return clazz as any;
      }
      const {kind, elements} = classOrDescriptor;
      console.assert(kind === 'class');
      return {
        kind,
        elements,
        // This callback is called once the class is otherwise fully defined
        finisher(clazz: Constructor<HTMLElement>) {
          window.customElements.define(tagName, clazz);
        }
      };
    };

/**
 * A property decorator which creates a LitElement property which reflects a
 * corresponding attribute value. A `PropertyDeclaration` may optionally be
 * supplied to configure property features.
 */
export const property = (options?: PropertyDeclaration) =>
    (protoOrDescriptor: Object|ClassElement, name?: PropertyKey): any => {
      if (name !== undefined) {
        // Legacy decorator
        (protoOrDescriptor.constructor as typeof UpdatingElement)
            .createProperty(name!, options);
        return;
      }
      const element = protoOrDescriptor as ClassElement;
      console.assert(element.kind === 'field');
      // createProperty() takes care of defining the property, but we still must
      // return some kind of descriptor, so return a descriptor for an unused
      // prototype field. The finisher calls createProperty().
      return {
        kind : 'field',
        key : Symbol(),
        placement : 'own',
        descriptor : {},
        // When @babel/plugin-proposal-decorators implements initializers, do
        // this instead of the initializer below.
        // See: https://github.com/babel/babel/issues/9260
        // extras: [
        //   {
        //     kind: 'initializer',
        //     placement: 'own',
        //     initializer: descriptor.initializer,
        //   }
        // ],
        initializer(this: any) {
          if (typeof element.initializer === 'function') {
            this[element.key] = element.initializer!.call(this);
          }
        },
        finisher(clazz: typeof UpdatingElement) {
          clazz.createProperty(element.key, options);
        }
      };
    };

/**
 * A property decorator that converts a class property into a getter that
 * executes a querySelector on the element's renderRoot.
 */
export const query = _query((target: NodeSelector, selector: string) =>
                                target.querySelector(selector));

/**
 * A property decorator that converts a class property into a getter
 * that executes a querySelectorAll on the element's renderRoot.
 */
export const queryAll = _query((target: NodeSelector, selector: string) =>
                                   target.querySelectorAll(selector));

/**
 * Base-implementation of `@query` and `@queryAll` decorators.
 *
 * @param queryFn exectute a `selector` (ie, querySelector or querySelectorAll)
 * against `target`.
 */
function _query<T>(queryFn: (target: NodeSelector, selector: string) => T) {
  return (selector: string) => (protoOrDescriptor: any, name?: string): any => {
    const descriptor = {
      get(this: LitElement) { return queryFn(this.renderRoot!, selector); },
      enumerable : true,
      configurable : true,
    };
    if (name !== undefined) {
      // Legacy decorator
      Object.defineProperty(protoOrDescriptor, name, descriptor);
    } else {
      const element = protoOrDescriptor as ClassElement;
      return {
        kind : 'method',
        placement : 'prototype',
        key : element.key,
        descriptor,
      };
    }
  };
}

/**
 * Adds event listener options to a method used as an event listener in a
 * lit-html template.
 *
 * @param options An object that specifis event listener options as accepted by
 * `EventTarget#addEventListener` and `EventTarget#removeEventListener`.
 *
 * Current browsers support the `capture`, `passive`, and `once` options. See:
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Parameters
 *
 * @example
 *
 *     class MyElement {
 *
 *       clicked = false;
 *
 *       render() {
 *         return html`<div @click=${this._onClick}`><button></button></div>`;
 *       }
 *
 *       @eventOptions({capture: true})
 *       _onClick(e) {
 *         this.clicked = true;
 *       }
 *     }
 */
export const eventOptions = (options: AddEventListenerOptions) =>
    (protoOrDescriptor: any, name?: string) => {
      if (name !== undefined) {
        // Legacy decorator
        Object.assign(protoOrDescriptor[name], options);
      } else {
        return {
          ...protoOrDescriptor,
          finisher(clazz: typeof UpdatingElement) {
            Object.assign(
                clazz.prototype[protoOrDescriptor.key as keyof UpdatingElement],
                options);
          },
        };
      }
    };
