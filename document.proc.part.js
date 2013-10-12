//     markdown-site-template
//     http://aplib.github.io/markdown-site-template/
//     (c) 2013 vadim b.
//     License: MIT
// require marked.js, controls.js, bootstrap.controls.js, doT.js, jquery.js

(function() { "use strict";
    
    if ($DOC.head)
        return;
    
    $DOC.events.load = new controls.Event();
    $DOC.transformation = transformation;

    // load user.js script:
    if ($DOC.options.userjs)
        $DOC.appendScript($DOC.root + $DOC.options.userjs);
    
    // These controls are are not attached, childs are attached
    var chead = controls.create('head'),
        cbody = controls.create('body'),
        head = document.head;
    $DOC.head = chead;
    $DOC.body = cbody;
    
    // Stub controls loading dispatcher
    var stubs = {};
    function stubResLoader(stub) {
        // here if stub
        var original__type = stub.parameters['#{__type}'].split('.');
        var stublist = stubs[original__type];
        if (!stublist) {
            stublist = [];
            stubs[original__type] = stublist;
        }
        stublist.push(stub);
        var url = $DOC.components + original__type[0] + '/' + original__type[1] + '/' + original__type[0] + '.' + original__type[1] + '.js';
        // load component asynchronously
        var component_js = $(head).children('script[src*="' + url +'"]:first')[0];
        if (!component_js) {
            var component_js = controls.extend(document.createElement('script'), {src:url, async:true});
            component_js.addEventListener('load', function() { stubs[original__type].forEach(function(stub){ stub.state = 1; }); stubs[original__type] = []; });
            component_js.addEventListener('error', function() { stubs[original__type].forEach(function(stub){ stub.state = -1; }); stubs[original__type] = []; });
            head.appendChild(component_js);
        }
    }
    
    // Add text fragment to controls tree
    var template = function(it) { return it.getText() + it.controls.map(function(control) { return control.wrappedHTML(); }).join(''); };
    $DOC.addTextContainer = function(control, text) {
        
        // container.outerHTML() returns text as is
        var container = control.add('container', {$text:text});
        
        // if text contains doT template then compile to getText function
        var pos = text.indexOf('{{');
        if (pos >= 0 && text.indexOf('}}') > pos) {
            container.getText = controls.doT.template(text);
            container.template(template);
        }
    };
    
    // $DOC.options.off - turn off filters and component translation
    $DOC.processContent = function(collection, content) {
        
        if (!content)
            return;
        
        if ($DOC.options.off) {
            $DOC.addTextContainer(collection, content);
            return;
        }
        
        // 1. check substitutions
        var filters = $DOC.filters;
        for(var i in filters) {
            var subst = filters[i];
            content = content.replace(subst.regex, subst);
        }

        // 2. Look for components
        var content = content.split(/(%\S{1,128})((?:#.*)?\([\S\s]*?\)\1)/gm);
        // todo replace \S [^\r\n\t @#\$%\^&\*\!~`\'\"\\|\/\?<>\{\}\[\]\(\)-_=\+]
        // \([^\(\)]*?\) - exclude matching the parts of multiple patterns, error: a()a b()b -> a()b

        var buffered_text = '';
        for(var i = 0, c = content.length; i < c; i++) {
            var frag = content[i];
            if (!frag) continue;
            if (i < c-1 && frag[0] === '%') {
                var next = content[i+1];
                if (next.slice(-frag.length - 1) === ')' + frag) {
            
                    var parpos = next.indexOf('('),
                        params = next.substr(0, parpos),
                        numberpos = params.indexOf('#'),
                        tag = frag.substr(1);

                    if (parpos >= 0 && (!params || numberpos === 0)) {
                        var inner_text = next.substr(parpos + 1, next.length - frag.length - parpos - 2);
                        i++;

                        // lookup control
                        try {
                            // pass inner text to control
                            var control = controls.createOrStub(tag+params, {$text: inner_text});
                            if (control) {
                                // flush buffer
                                if (buffered_text/* && (buffered_text.length > 16 || buffered_text.trim())*/) {
                                    $DOC.addTextContainer(collection, buffered_text);
                                    buffered_text = '';
                                }

                                collection.add(control);

                                // create component loader
                                if (control.isStub)
                                    new stubResLoader(control);
                            }
                            else
                                collection.add('p', {$text:'&#60;' + tag + '?&#62;'});

                            continue;
                        } catch (e) { console.log(e); } // error?
                    }
                }
            }
            buffered_text += frag;
        }
        
        // flush buffer
        if (buffered_text/* && (buffered_text.length > 16 || buffered_text.trim())*/)
            $DOC.addTextContainer(collection, buffered_text);
    };
    

    var sections = $DOC.sections,
        order = $DOC.order,
        log_level = $ENV.log_level;

    // process found sections content
    var processed_nodes = [], head_processed;
    function processSections(process_head) {
        
        if (!process_head && !document.body)
            return;
        
        var translated_sections = [];
        
        // process DOM
        // get list of the special marked text elements from the dom tree
        // syntax:
        // <--sectionname ... -->
        // <--%[namespace.]cid[#parameters]( ... )%[namespace.]cid-->
        //
        var text_nodes = [],
            iterator = document.createNodeIterator(process_head ? document.head : document.body, 0x80, null, false),
            text_node = iterator.nextNode(),
            fordelete = [];

        while(text_node) {
            text_nodes.push(text_node);
            text_node = iterator.nextNode();
        }
        
        if (process_head && text_nodes.length)
            head_processed = true;
        
        // iterate text elements and process the each of them
        for(var i = 0, c = text_nodes.length; i < c; i++) {
            var text_node = text_nodes[i];
            
            if (processed_nodes.indexOf(text_node) < 0) {
                var control = undefined, fordel = false, text = text_node.nodeValue, first_char = text[0];
                if (' \n\t[@$&*#'.indexOf(first_char) < 0) {
                    try {
                        if (first_char === '%') {
                            // <--%namespace.cid#params( ... )%namespace.cid-->
                            // \1 cid \2 #params \3 content
                            var match = text.match(/^(%(?:[^ \t\n\(]{1,128}\.)?[^ \t\n\(]{1,128})(#[^\t\n\(]{1,512})?\(([\S\s]*)\)\1$/);
                            if (match) {
                                // create control
                                control = controls.createOrStub(match[1].slice(1) + (match[2] || ''), {$text: match[3]});
                            }
                        } else if (first_char === '!') {
                            // <!--!sectionname--> - section remover
                            $DOC.removeSection(text.slice(1));
                            fordel = true;
                        } else {
                            // <--sectionname...-->
                            var namelen = text.indexOf(' '),
                                eolpos = text.indexOf('\n'),
                                move = text.indexOf('->');
                            if (namelen < 0 && eolpos < 0 && move < 0) {
                                // <--sectionname-->
                                $DOC.sectionPlaceholder(text, text_node);
                                // Do not delete the placeholder!
                            } else if (namelen < 0 && move > 0) {
                                // <--sectionname->newname-->
                                $DOC.sectionMover(text_node, text.slice(0, move), text.slice(move + 2));
                                fordel = true;
                            } else {
                                // <--sectionname ...-->
                                if (eolpos > 0 && (namelen < 0 || eolpos < namelen))
                                    namelen = eolpos;
                                if (namelen > 0 && namelen < 128) {
                                    var section_name = text.slice(0, namelen),
                                    // create section div
                                    control = controls.create('div', {class:section_name});
                                    control.name = section_name;
                                    $DOC.addSection(section_name, control);
                                    control.template($ENV.default_template, $ENV.default_inner_template);
                                    $DOC.processContent(control, text.slice(namelen + 1));
                                    translated_sections.push(section_name);
                                }
                            }
                        }
                        if (control) {
                            // insert control element to DOM
                            
                            /* ? if (!control._element) // element exists if placeholder ? */
                                control.createElement(text_node, 2/*before node*/);
                            if (control._element && control._element.parentNode === document.body)
                                cbody.add(control);

                            // create component loader
                            // FIX: (for orphaned control) start loading after DOM element was created
                            if (control.isStub)
                                new stubResLoader(control);
                        }
                    } catch (e) { console.log(e); }
                }
                ((fordel || control) ? fordelete : processed_nodes).push(text_node);
            }
        }
        
        // delete processed nodes
        for( var i = fordelete.length - 1; i >= 0; i--) {
            var node = fordelete[i], parent = node.parentNode;
            parent.removeChild(node);
        }
        
        if (process_head)
            return;
        
        
        // check body
        if (!cbody._element && document.body)
            cbody.attachAll();
        if (!cbody._element)
            return;
        
        // process other named sections content, applied from controls or user.js
        //
        for(var name in sections)
        if (name) { // skip unnamed for compatibility
            try
            {
                var placeholder, content = sections[name];
                if (content && content.placeholder) {
                    placeholder = content.placeholder;
                    content = content.content;
                }
                if (typeof content === 'string') {

                    if (log_level)
                        console.log('>section ' + name);

                    // translate section to control object

                    var section_control = cbody.add(name + ':div', {class:name});
                    section_control.template($ENV.default_template, $ENV.default_inner_template);
                    $DOC.processContent(section_control, content);


                    // create dom element

                    // look for element position in dom
                    
                    var created = false;
                    
                    if (placeholder) {
                        section_control.createElement(placeholder, 2);
                        created = true;
                    } else {
                        var in_order = order.indexOf(name);
                        if (in_order >= 0) {

                            // look element after in order
                            for(var i = in_order + 1, c = order.length; i < c; i++) {
                                var exists_after_in_order = sections[order[i]];
                                if (exists_after_in_order && typeof exists_after_in_order !=='string') {
                                    // insert before
                                    section_control.createElement(exists_after_in_order._element, 2);
                                    created = true;
                                    break;
                                }
                            }

                            if (!created)
                            // look element before in order
                            for(var i = in_order - 1; i >= 0; i--) {
                                var exists_before_in_order = sections[order[i]];
                                if (exists_before_in_order && typeof exists_before_in_order !=='string') {
                                    // insert after
                                    section_control.createElement(exists_before_in_order._element, 3);
                                    created = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!created)
                        section_control.createElement(document.body, 0);
                    
                    sections[name] = section_control;
                    translated_sections.push(name);
                }
            }
            catch (e) { console.log(e); }
        }
        
        if (translated_sections.length > 0)
            apply_patches(translated_sections);
    }

    // document transformation started after all libraries and user.js is loaded
    function transformation()
    {
        if ($DOC.state > 0)
            return;
        
        $DOC.state = 1;
        
        chead.attachAll();
        cbody.attachAll();
        
        var gen_flag = document.body && document.body.getAttribute('data-generator'),
        page_ready = gen_flag && gen_flag.indexOf('embed-processed') >= 0;
        if (page_ready) {
            
            // page already generated
            
            var timer = setInterval(function() { onresize(); }, 25);
            var dom_loaded_handler = function() {
                cbody.attachAll();
                onresize();
                $(window).on('resize', onresize);
                dom_loaded_handler = undefined;
            };

            // can be fired
            window.addEventListener('DOMContentLoaded', function() {
                if (dom_loaded_handler)
                    dom_loaded_handler();
            }, false);
        
            window.addEventListener('load', function() {

                clearInterval(timer); // off timer after css loaded

                if (dom_loaded_handler)
                    dom_loaded_handler();

                // raise 'load' event
                $DOC.state = 2;
                $DOC.isLoaded = true;
                var load_event = $DOC.forceEvent('load');
                load_event.raise();
                load_event.clear();

                onresize(); // before and after 'load' event
            });
            
        } else {
            
            // page transformation
            
            processSections(true);
            processSections();
            
            // delay first transformation -> timer
            var timer = setInterval(function() {
                if (!head_processed)
                    processSections(true);
                processSections(); // sections may be inserted by components
                onresize();
            }, 25);
        
            var dom_loaded_handler = function() {
                if (!head_processed)
                    processSections(true);
                processSections();
                document.body.setAttribute('data-generator', 'MST/embed-processed');
                onresize();
                $(window).on('resize', onresize);
                dom_loaded_handler = undefined;
            };

            // can be fired
            window.addEventListener('DOMContentLoaded', function() {
                if (dom_loaded_handler)
                    dom_loaded_handler();
            }, false);
        
            window.addEventListener('load', function() {

                clearInterval(timer); // off timer after css loaded

                if (dom_loaded_handler)
                    dom_loaded_handler();
                
                // scroll to hash element
                // scroll down if fixtop cover element
                if (window.location.hash) {
                    window.location = window.location;
                    var pad = parseInt(window.getComputedStyle(document.body).paddingTop);
                    if (pad)
                        window.scrollBy(0, -pad);
                }
                
                // raise 'load' event
                $DOC.state = 2;
                $DOC.isLoaded = true;
                var load_event = $DOC.forceEvent('load');
                load_event.raise();
                load_event.clear();

                onresize(); // before and after 'load' event
            });
        }
    }
    
    // apply js patches for dom elements on transformation progress
    function apply_patches(translated_section) {

        $('table').addClass('table table-bordered table-stripped');
    }
    // fired on 1. dom manipulation 2. css loading in progress can size effects 3. window resize after page loaded
    function onresize() {
        // body padding
        var css = '', top = 0, right = 0, bottom = 0, left = 0;
        function calc(classname, prop) {
            var result = 0;
            for(var i = 0, elements = document.getElementsByClassName(classname), c = elements.length; i < c; i++)
                result += elements[i][prop];
            return result;
        }
        top += calc('fixed-top-bar', 'clientHeight');
        top += calc('fixed-top-panel', 'clientHeight');
        right += calc('fixed-right-side-bar', 'clientWidth');
        right += calc('fixed-right-side-panel', 'clientWidth');
        bottom += calc('fixed-bottom-bar', 'clientHeight');
        bottom += calc('fixed-bottom-panel', 'clientHeight');
        left += calc('fixed-left-side-bar', 'clientWidth');
        left += calc('fixed-left-side-panel', 'clientWidth');
        
        css += 'body{padding: ' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px;}';
        $DOC.appendCSS('document#onresize', css);
    }
    
})();
