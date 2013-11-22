(function() { 'use strict';
    var db, host, cpanel, controller, table, toolbar, tabheaders, options, code_edit, parser, preview;
    if (this.top !== this.self || this['mw-document-editor']) return; this['mw-document-editor'] = true;
    if (typeof $ENV !== 'undefined') initialize(); else { if (!this.defercqueue) this.defercqueue = []; this.defercqueue.push(initialize); }

    function initialize() {
        
        $(window).load(function() {
            db = new DB(location.origin + location.pathname, openEditor);
        });
        
        function openEditor() {
            
            $DOC.cbody.attachAll();
            $DOC.appendCSS('document.editor.css', '.tooltip, .popover { z-index:1200; }');
            
            // parser-builder
            parser = new Parser();
            
            // preview
            $DOC.cbody.add(preview = new Preview());
            preview.createElement();
            
            // toolbar
            
            table = $DOC.cbody.add('div', {style:'overflow:hidden; border-radius:4px; position:fixed; top:20px;bottom:20px;right:20px; height:50%; width:50%; z-index:1101; border: silver solid 1px; background-color:white;'});
            toolbar = table.add('toolbar:div', {class:'clearfix', style:'z-index:1111; background-color:#f0f0f0; line-height:32px; padding:0;'})
                .listen('element', function(element) {
                    if (element)
                        $(element).find('button,li,a').tooltip({placement:'bottom', container:'body', toggle:'tooltip'});
                });
            
            // buttons revert, download, save
            
            toolbar.add('save_group:bootstrap.BtnGroup', {class:'mar5'}, function(save_group) {
                //toolbar.save_group.add('formatting:bootstrap.Button', {$icon:'font',      'data-original-title':'Formatting toolbar'});
                
                // revert button
                save_group.add('revert:bootstrap.Button',   {$icon:'backward',  'data-original-title':'Revert'})
                    .listen('click', function() {
                        controller.revert();
                    });
                    
                // download button
                save_group.add('download:a', { download: (decodeURI(location.pathname).split('/').slice(-1)[0] || 'document.html'),
                    class:'btn btn-default', $text:'<b class="glyphicon glyphicon-save"></b>', 'data-original-title':'Download'})
                    .listen('mousedown', setDataUrl)
                    .listen('focus', setDataUrl)
                    .listen('click', function(event) {
                        try {
                            // IE
                            var blob = new Blob([controller.buildHTML()]);
                            window.navigator.msSaveOrOpenBlob(blob, (decodeURI(location.pathname).split('/').slice(-1)[0] || 'document.html'));
                            event.preventDefault();
                            return;
                        } catch(e) {}
                    });
                    function setDataUrl() {
                        // download data:link chrome+ firefox+ opera+ ie- safari-
                        // context menu 'Save link as...'. 
                        controller.save();
                        save_group.download.element.href = (window.navigator.appName.indexOf('etscape') > 0 ? 'data:unknown'/*Safari*/ : 'data:application'/*other*/) + '/octet-stream;charset=utf-8,' + encodeURIComponent(controller.buildHTML());
                    }
                    
                // save button
                save_group
                    .add('save:bootstrap.Button', {class:'btn btn-default disabled', $icon:'edit', 'data-original-title':'Save'})
                        .listen('click', function() {
                            controller.save();
                            host.write(decodeURI(window.location.pathname), controller.buildHTML());
                        });
                        
                toolbar.add('cpanel:bootstrap.Button', {class:'hide btn btn-default fleft martop5 marbottom5 marleft5 padleft15 padright15', $icon:'cog', 'data-original-title':'Control panel'})
                    .listen('click', function() {

                    });
            });
            
            // buttons fullscreen, flip, close
            
            toolbar.add('bootstrap.Button', {class:'mar5 fright', $icon:'remove', 'data-original-title':'Close editor (Ctrl-F12)'})
                .listen('click', function() {
                    var url = location.href, pos = url.indexOf('?edit'); if (pos < 0) pos = url.indexOf('&edit');
                    if (pos >= 0)
                        window.location = url.slice(0, pos) + url.slice(pos + 5);
                });

            var split = toolbar.add('bootstrap.Splitbutton', {class:'martop5 fright', $icon:'fullscreen'});
            split.button.listen('click', function() {
                controller.mode = (controller.mode) ? 0 : 1;
            });
            var items = split.items;
            items.add('bootstrap.DropdownItem', {$icon:'chevron-left'}).listen('click', function() {
                controller.position = 1;
            });
            items.add('bootstrap.DropdownItem', {$icon:'chevron-right'}).listen('click', function() {
                controller.position = 0;
            });
            items.add('bootstrap.DropdownItem', {$icon:'chevron-up'}).listen('click', function() {
                controller.position = 2;
            });
            items.add('bootstrap.DropdownItem', {$icon:'chevron-down'}).listen('click', function() {
                controller.position = 3;
            });
            
            // tabheaders
            
            toolbar.add(tabheaders = new TabHeaders());
            
            // code edit

            table.add(code_edit = new CodeEditor());
            table.add(options = new Options());
            
            // create form
            table.createElement();
            
            // app controller
            controller = new Controller();
            
            // host adapter
            host = new Host();
        }
     }
    
    
    // options page
    function Options() {
        
        var options = controls.create('div', {class:'pad20'});
        
        var visible = true;
        Object.defineProperty(options, 'visible', {
            get: function() { return visible; },
            set: function(value) { visible = value; if (options.element) options.element.style.display = (visible) ? 'block' : 'none'; }
        });
        options.listen('element', function(element) { if (element) element.style.display = (visible) ? 'block' : 'none'; });
        
        var title_grp = options.add('bootstrap.FormGroup');
        title_grp.add('bootstrap.ControlLabel', {$text:'Title:'});
        title_grp.add('title_edit:bootstrap.ControlInput', {value:''})
            .listen('change', function() {
                parser.title = title_grp.title_edit.value;
            });
        
        parser.listen(function() {
            if (parser.title !== title_grp.title_edit.value)
                title_grp.title_edit.value = parser.title;
        });
        
        // to check for changes and rise data event
        options.save = function() {
        };
        
        return options;
    }


    function CodeEditor() { // mode, text, section
        
        var code_edit = controls.create('textarea', {class:'form-control', style:'font-family:Consolas,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New,monospace; display:none; border:0; border-radius:0; border-left:#f9f9f9 solid 6px; box-shadow:none; width:100%; height:100%; resize:none; '});
        
        code_edit.code_edit_resize = function() {
            code_edit.element.style.height = ($(table.element).height() - $(toolbar.element).height()) + 'px';
        };
        $(window).on('resize', code_edit.code_edit_resize);
        
        var mode = 0; // 0 - options, hide text area, 1 - html, 2 - section
        Object.defineProperty(code_edit, 'mode', {
            get: function() { return mode; },
            set: function(value) {
                if (value > 2)
                    value = 2;
                if (value !== mode) {
                    mode = value;
                    if (this.element)
                        code_edit.element.style.display = (mode) ? 'block' : 'none';
                    code_edit.code_edit_resize();
                }
            }
        });
        var editvalue;
        code_edit.listen('element', function(element) {
            if (element)
                element.value = editvalue;
            code_edit.code_edit_resize();
        });
        Object.defineProperty(code_edit, 'text', {
            get: function() { return this.element ? this.element.value : editvalue; },
            set: function(value) {
                editvalue = value || '';
                if (this.element)
                    this.element.value = editvalue;
                this.modified = 0;
            }
        });
        // to check for changes and rise data event
        code_edit.save = function() {
            checkForChanges();
            if (this.modified) {
                this.modified = 0;
                this.raise('text', editvalue);
            }
        };
        function checkForChanges() {
            if (code_edit.mode) {
                var element = code_edit._element;
                if (element && element.value !== editvalue) {
                    code_edit.modified = 25;
                    editvalue = element.value;
                }
            }
        }
        code_edit.listen('change', checkForChanges, true);
        
        setInterval(function() {
            checkForChanges();
            if (code_edit.modified)
            if (--code_edit.modified < 2) {
                code_edit.modified = 0;
                code_edit.raise('text', editvalue);
            }
        }, 25);
        
        return code_edit;
    }
    
    
    function TabHeaders() {
        // item { id: text: hint: icon: }
        var selected, selectedIndex = -1;
        
        var tabs_header_control = toolbar.add('tabs_header:bootstrap.TabPanelHeader');
        tabs_header_control.bind(controls.create('dataarray'));
        
        // predefined tabs
        tabs_header_control.data.push({isoptions:true, text:'', hint:'Page options', icon:'list-alt'}, {ishtml:true, text:'HTML', hint:'Edit as HTML'});
        
        // set tab list
        tabs_header_control.setTabs = function(tabs) {
            var data = tabheaders.data;
            
            if (tabs.length + 2 < data.length)
                data.splice(1, data.length - tabs.length - 2);
            
            for(var i = data.length, to = tabs.length + 2; i < to; i++)
                data.splice(1, 0, {});
            
            for(var i = 1, c = data.length - 1; i < c; i++)
                data[i].text = tabs[i-1];

            data.raise();
        };
        
        function tabClick() {
            tabs_header_control.selectedIndex = tabs_header_control.controls.indexOf(this);
        }
        
        // synchronize controls with data array
        tabs_header_control.listen('data', function() {
            var subcontrols = tabs_header_control.controls, data = this.data;
            
            for(var i = subcontrols.length, c = data.length; i < c; i++)
                tabs_header_control.add('bootstrap.TabHeader')
                    .listen('click', tabClick);
                
            for(var i = subcontrols.length - 1, c = data.length; i >= c; i--) {
                var control = subcontrols[i];
                control.deleteAll();
                control.removeListener('click', tabClick);
                tabs_header_control.remove(control);
            }
            
            for(var i = 0, c = data.length; i < c; i++) {
                var item = data[i];
                item.id = subcontrols[i].id;
                var control = subcontrols[i];
                control.attributes['data-original-title'] = item.hint;
                control.attributes.$icon = item.icon;
                control.text(item.text);
                if (item === selected)
                    control.class('active');
                else
                    control.class(null, 'active');
            }
            
            tabs_header_control.checkSelection();
            
            if (tabs_header_control.element)
                tabs_header_control.refresh();
        });
        
        // selected
        
        Object.defineProperty(tabs_header_control, 'selectedIndex',
        {
            get: function() { return selectedIndex; },
            set: function(value) { this.selected = value; }
        });
        Object.defineProperty(tabs_header_control, 'selected',
        {
            get: function() { return selected; },
            set: function(value) {
                
                var data = this.data;

                if (typeof value === 'string') {
                    // by id
                    for(var i = 0, c = data.length; i < c; i++) {
                        var item = data[i];
                        if (item.id === value) {
                            this.selected = item;
                            return;
                        }
                    }
                    // by text
                    for(var i = 0, c = data.length; i < c; i++) {
                        var item = data[i];
                        if (item.text === value) {
                            this.selected = item;
                            return;
                        }
                    }
                    return;
                }
            
                if (typeof value === 'number') {
                    if (value >= 0 && value < data.length && value !== selectedIndex)
                        this.selected = data[value];
                    else if ( value === -1)
                        this.selected = undefined;
                    return;
                }
                
                var index = data.indexOf(value);
                if (index >= 0) {
                    var item = data[index];
                    if (item !== selected && selected)
                        this.lastSelected = selected;
                }
                if (value !== selected || index !== selectedIndex) {
                    for(var subcontrols = this.controls, i = 0, c = subcontrols.length; i < c; i++) {
                        if (i === index)
                            subcontrols[i].class('active');
                        else
                            subcontrols[i].class(null, 'active');
                    }
                    this.raise('selected', selected = value ? value : undefined, selectedIndex = index);
                }
            }
        });
        
        tabs_header_control.checkSelection = function() {
            var data = this.data;
            if (!data.length)
                this.selected = -1;
            else {
                var index = data.indexOf(selected);
                if (index < 0)
                    this.selected = this.lastSelected;
                if (!this.selected)
                    this.selected = 0;
            }
        };

        return tabs_header_control;
    }
    
    
    function Preview() {
        var update_inner_html, sections_keys;
        
        // set preview mode to url
        var url = location.href;
            url = url.slice(0, url.length - location.hash.length);
            if (url.indexOf('?') > 0)
                url += '&preview';
            else
                url += '?preview';
        preview = controls.create('iframe', {sandbox:'', src:url, style:'position:fixed; left:0; top:0; width:100%; height:100%; z-index:1100; border:none;'});
        
        preview.updateInnerHtml = function(inner_html, _sections_keys) {
            update_inner_html = inner_html;
            sections_keys = _sections_keys;

            var doc = this.element && this.element.contentDocument,
                $doc = this.$DOC;
            if (doc && $doc) {

                var html = doc.getElementsByTagName('html')[0];
                if (html) {
                    $doc.initialize();
                    // update html
                    html.innerHTML = inner_html;
                    // reproduce document
                    $doc.headTransformation();
                    if ($doc.options.userjs) {
                        $doc.loadUserJS(); // final transformation started after script loaded
                    } else {
                        setTimeout(function(){
                            $doc.finalTransformation();
                        },0);
                    }
                }
            }
        };
        
        preview.reload = function() {
            if (this.element)
                this.deleteAll();
            this.createElement();
        };
        
        preview.listen('load', function() {
            // window.load event handlers preforms final transformation
            setTimeout(function() {
                // check if navigated out the current location
                try {
                    if (this.element.contentWindow.location.pathname !== window.location.pathname)
                        this.reload();
                } catch (e) {
                    this.reload();
                }

                this.$DOC = this.element && preview.element.contentWindow.$DOC;

                // update html
                if (update_inner_html !== undefined)
                    this.updateInnerHtml(update_inner_html, sections_keys);
            }.bind(preview), 0);
        });

        preview.updateNamedSection = function(name, text, updated_inner_html) {
            update_inner_html = updated_inner_html;
            var doc = this.$DOC;
            var doc_section = doc.sections[name];
            if (typeof doc_section === 'object' && doc_section.source_node) {
                doc.processTextNode(doc_section.source_node, name + '\n' + text);
            }
        };
        
        return preview;
    }
    
    
    // Parser and builder. Parse html and create html build tree.
    // 
    // html - parsed html
    // chtml - html builder root control
    // sections - parsed sections
    // seccontrols - map section name -> builder node
    function Parser() {
        var html;
        
        // >> key elements
        var chead;
        
        var title, ctitle;
        Object.defineProperty(this, 'title',
        {
            get: function() { return title; },
            set: function(value) {
                title = value;
                if (!ctitle) {
                    if (!chead)
                        return;
                    ctitle = chead.add('div');
                    ctitle.template(template);
                }
                ctitle.controls.length = 0;
                ctitle.opentag = '<title>' + value + '</title>';
                ctitle.closetag = '';
                html = this.buildHTML();
                this.raise();
            }
        });
        
        // << key elements
        
        function template() { // builder control template
            return (this.opentag || '')
                + (this.attributes.$text || '') + this.controls.map(function(control) { return control.outerHTML(); }).join('')
                + (this.closetag || '');
        };
        
        Object.defineProperty(this, 'html',
        {
            get: function() { return html; },
            set: function(value) {
                if (value !== html) {
                    html = value;
                    
                    var sections = {}, seccontrols = {};
                
                    var doc = document.implementation.createHTMLDocument('');
                    var docelement = doc.documentElement;
                    docelement.innerHTML = /<html[\s\S]*?>([\s\S]*)<\/html>/mi.exec(html)[1];

                    var chtml = controls.create('div'); // root control
                    var nodes = [], nodecontrols = [];

                    var iterator = doc.createNodeIterator(docelement, 0xFFFF, null, false),
                        node = iterator.nextNode();
                    while(node) {

                        var control = (node === docelement) ? chtml : controls.create('div');
                        control.template(template);
                        nodes.push(node);
                        nodecontrols.push(control);
                        var index = nodes.indexOf(node.parentNode);
                        if (index >= 0)
                            nodecontrols[index].add(control);

                        // parse text node
                        if (node.nodeType === 8) {
                            var text = node.nodeValue, first_char = text[0];
                            control.opentag = '<!--' + node.nodeValue + '-->';

                            if (first_char === '%') {
                                // <--%namespace.cid#params( ... )%namespace.cid-->
                                // \ 1 cid \ 2 #params \ 3 content
                            } else if (first_char === '!') {
                                // <!--!sectionname--> - section remover
                            } else {
                                // <--sectionname...-->
                                var namelen = text.indexOf(' '),
                                    eolpos = text.indexOf('\n'),
                                    move = text.indexOf('->');
                                if (namelen < 0 && eolpos < 0 && move < 0) {
                                    // <--sectionname--> placeholder
                                } else if (namelen < 0 && move > 0) {
                                    // <--sectionname->newname--> mover
                                } else {
                                    if (eolpos > 0 && (namelen < 0 || eolpos < namelen))
                                        namelen = eolpos;
                                    if (namelen > 0 && namelen < 128) {
                                        var secname = text.slice(0, namelen);
                                        sections[secname] = text.slice(namelen + 1);
                                        seccontrols[secname] = control;
                                    }
                                }
                            }
                        } else if (node === docelement) {
                            // incorrect parsing <html> tag
                                
                            control.opentag = '<!DOCTYPE html>\n' + /(<html[\s\S]*?>)[\s\S]*?<head/mi.exec(html)[1] + '\n';
                            control.closetag = '\n</html>';
                        } else {
                            // create template for no text node control

                            var outer = node.outerHTML, inner = node.innerHTML;
                            if (inner) {
                                var pos = outer.lastIndexOf(inner);
                                if (pos < 0)
                                    control.opentag = outer;
                                else {
                                    control.opentag = outer.slice(0,pos);
                                    control.closetag = outer.slice(pos + inner.length);
                                }
                            } else if (outer)
                                control.opentag = outer;
                            else
                                control.opentag = node.nodeValue;
                        }
                        node = iterator.nextNode();
                    }
                    
                    // >> key elements
                    
                    // head
                    var ehead = doc.getElementsByTagName('head')[0];
                    chead = ehead && nodecontrols[nodes.indexOf(ehead)];

                    
                    // title
                    var etitle = doc.getElementsByTagName('title')[0];
                    if (etitle) {
                        title = etitle.textContent;
                        ctitle = nodecontrols[nodes.indexOf(etitle)];
                    } else {
                        title = '';
                        ctitle = null;
                    }
                    
                    
                    
                    // << key elements
                    
                    this.chtml = chtml;
                    this.sections = sections;
                    this.seccontrols = seccontrols;
                    this.raise();
                }
            }
        });
        
        this.updateNamedSection = function(name, value) {
            var build_control = this.seccontrols[name];
            if (build_control) {
                this.sections[name] = value;
                build_control.opentag = '<!--' + name + '\n' + (value) + '-->\n';
                html = this.chtml.outerHTML();
            }
        };

        this.buildHTML = function() {
            return this.chtml.outerHTML();
        };
    }
    Parser.prototype = controls.create('DataObject');
    
    
    function Controller() {
        var source_html;
        
        // on parser update html
        parser.listen(function() {
            controller.edit_html = parser.html;
            // update tabheaders
            tabheaders.setTabs(Object.keys(parser.sections));
            // update preview
            preview.updateInnerHtml(parser.chtml.innerHTML(), Object.keys(parser.sections));
        });

        // edited html
        var edit_html;
        Object.defineProperty(this, 'edit_html', {
            get: function() { return edit_html; },
            set: function(value) {
                if (value !== edit_html) {
                    edit_html = value;
                    parser.html = edit_html;
                }
            }
        });

        function activity() {
            if (controller.modified)
                controller.modified = 25;
        }
        
        // check unsaved changes
        this.checkEdits = function() {
            var tab = tabheaders.selected;
            if (tab && tab.isoptions)
                options.save();
            else if (tab)
                code_edit.save();
        };

        // on tab header selected
        tabheaders.listen('selected', this, function() {
            this.checkEdits();
            // update code_edit
            this.updateCodeEdit();
            this.modified = 5;
            options.visible = (tabheaders.selectedIndex === 0);
        });
        
        // update edit area
        this.updateCodeEdit = function() {
            var tab = tabheaders.selected;
            code_edit.mode = (!tab || tab.isoptions) ? 0 : (tab.ishtml) ? 1 : 2;
            switch(code_edit.mode) {
                case 1: // html
                    code_edit.text = controller.edit_html;
                    break;
                case 2: // sections
                    var selected = tabheaders.selected;
                    if (selected) {
                        // set selected section name and text to edit
                        code_edit.section = selected.text;
                        code_edit.text = parser.sections[selected.text];
                    } else
                        code_edit.text = '';
                    break;
                default:
                    code_edit.text = '';
            }
        };
        // on code editor data
        code_edit.listen('text', function(edit_value) {
            switch(code_edit.mode) {
                case 1: // html edited
                    controller.edit_html = edit_value;
                    controller.modified = 25;
                    break;

                case 2: // section code edited
                    controller.updateNamedSection(code_edit.section,  code_edit.text);
                    controller.modified = 25;
                    break;
            }
        });

        // update one section when the value of section edited
        this.updateNamedSection = function(name, value) {
            parser.updateNamedSection(name, value);
            edit_html = parser.buildHTML();
            preview.updateNamedSection(name, value, parser.chtml.innerHTML());
        };

        // save()
        this.save = function() {
            this.checkEdits();
            
            var data = db.dataobject.data;
            data.selected = tabheaders.selected && tabheaders.selected.text;
            data.html = this.edit_html;
            if (data.html === source_html)
                data.delete = true;
            db.dataobject.raise();
            
            this.modified = 0;
        };

        // revert()
        this.revert = function() {
            this.edit_html = source_html;
            this.updateCodeEdit();
            this.modified = 2;
            setTimeout(function() { window.location.reload(); }, 300);
        };

        this.buildHTML = function() {
            code_edit.save();
            return parser.buildHTML();
        };

        // >> form layout

        var mode = 0, position = 0, hpadding = 600, vpadding = 500;
        function setStyle(ptop, pright, pbottom, pleft, pwidth, pheight, ttop, tright, tbottom, tleft, twidth, theight) {
            var style = preview.element.style;
            style.top = ptop; style.right = pright; style.bottom = pbottom; style.left = pleft; style.width = pwidth; style.height = pheight;
            style = table.element.style;
            style.top = ttop; style.right = tright; style.bottom = tbottom; style.left = tleft; style.width = twidth; style.height = theight;
        }
        function relayout() {
            if (mode) {
                switch(position) {
                    case 1: setStyle('0', '0', '0', '0', '100%', '100%',  'auto', 'auto', '20px', '20px', '50%', '50%'); break;
                    case 2: setStyle('0', '0', '0', '0', '100%', '100%',  '20px', 'auto', 'auto', '20px', '50%', '50%'); break;
                    case 3: setStyle('0', '0', '0', '0', '100%', '100%',  'auto', '20px', '20px', 'auto', '50%', '50%'); break;
                    default:setStyle('0', '0', '0', '0', '100%', '100%',  '20px', '20px', 'auto', 'auto', '50%', '50%');
                }
            } else {
                switch(position) {
                    case 1: setStyle('0', '0', '0', 'auto', '50%', '100%',  '0', 'auto', '0', '0', '50%', '100%'); break;
                    case 2: setStyle('auto', '0', '0', '0', '100%', '50%',  '0', '0', 'auto', '0', '100%', '50%'); break;
                    case 3: setStyle('0', '0', 'auto', '0', '100%', '50%',  'auto', '0', '0', '0', '100%', '50%'); break;
                    default:setStyle('0', 'auto', '0', '0', '50%', '100%',  '0', '0', '0', 'auto', '50%', '100%');
                }
            }
            code_edit.code_edit_resize();
        }
        
        // 0 - nonoverlapping preview and editor panels, 1 - preview full window, editor overlaps the preview window, 2 - preview in separate window
        Object.defineProperty(this, 'mode', {
            get: function() { return mode; },
            set: function(value) {
                mode = value;
                relayout();
                controller.saveLayout();
            }
        });

        // 0 - right, 1 - left, 2 - top, 3 - bottom
        Object.defineProperty(this, 'position', {
            get: function() { return position; },
            set: function(value) {
                position = value;
                relayout();
                controller.saveLayout();
            }
        });

        this.saveLayout = function() {
            if (typeof localStorage !== 'undefined')
                localStorage.setItem('editor layout', [mode, position, hpadding, vpadding].join(';'));
        };

        if (typeof localStorage !== 'undefined') {
            try {
                var vars = localStorage.getItem('editor layout').split(';');
                mode = parseInt(vars[0]);
                position = parseInt(vars[1]);
                hpadding = parseInt(vars[2]);
                vpadding = parseInt(vars[3]);
            } catch(e) {}
            relayout();
        }

        // << form layout


        // initialize
        db.restore(function() {
            $.ajax({url:location.href, type:'GET', dataType:'html'})
                .done(function(response) {
                    var default_selected = localStorage && localStorage.getItem('default selected page');
                    tabheaders.lastSelected = db.dataobject.data.selected || default_selected || tabheaders.data[0];
                    source_html = response.replace(/\r/g, '');
                    controller.edit_html = db.dataobject.data.html || source_html;
                    tabheaders.checkSelection();
                });
        });
        
        setInterval(function() {
            if (this.modified && --this.modified < 2) {
                this.modified = 0;
                this.save();
            }
        }.bind(this), 25);
    }
    
    function Host() {
        this.environment = 0; //  1 - node-webkit, 2 - hosted
        this.fileName = getFName(location.href); // page file name
        
        function getFName(path) {
            var pos = path.lastIndexOf('/');
            if (pos >= 0) path = path.slice(pos + 1);
            pos = path.lastIndexOf('\\');
            if (pos >= 0) path = path.slice(pos + 1);
            return path;
        }
        
        // node-webkit
        if (typeof nwDispatcher !== 'undefined' && location.protocol === 'file:') {
            this.environment = 1;
            this.editable = true;
            toolbar.save_group.save.class(null, 'disabled');
            
            // write file
            var fs = require('fs');
            this.write = function(fname, data) {
                try {
                    fs.writeFileSync(getFName(fname), data);
                    db.reloadOnReady();
                } catch(e) {console.log(e);
                    // write fail
                };
            };
            
        // hosted webapplication
        } else if (location.protocol !== 'file:') {
            var href = location.href, pos = href.lastIndexOf('/'), curl /*controller url*/ = href.slice(0, pos) + '/@';

            this.write = function(fname, data) {
                if (curl)
                $.ajax({url:curl, type:'POST', dataType:'json', contentType:'application/json; charset=UTF-8', async:0, data:JSON.stringify({command:'write', url:fname, data:data})})
                    .done(function(response) {
                        if (response.result === 'success')
                            db.reloadOnReady();
                    });
            };

            if (curl)
            $.ajax({url:curl, type:'POST', dataType:'json', contentType:'application/json; charset=UTF-8', data:JSON.stringify({command:'options'})})
                .done(function(response) {
                    if (response.result === 'success') {
                        this.environment = 2;
                        if (this.editable = response.editable)
                            toolbar.save_group.save.class(null, 'disabled');
                    }
                });
        }
    }
    
    // Database engine adapter
    // If not supported both indexedDB and webSQL no call ready callback and error message
    function DB(pageid, onready) {
        var db = this, modified, indexeddb, websqldb, restored/*dataobject is restored*/;
        
        // dataobject attribute 'data' contains stored data object
        var dataobject = db.dataobject = controls.create('DataObject');
        dataobject.data = {key:pageid, history:[]};
        dataobject.listen(function() {
            modified = true;
        });
        setInterval(function() {
            if (modified) {
                db.write();
            }
        }, 25);

        
//        // try to open ldbserver
//        var cldb = $DOC.cbody.add('iframe', {src:'http://aplib.github.io/ldbserver.html', style:'display:none;'});
//        cldb.createElement();
//        // ldbserver open error
//        cldb.listen('error', function() {
//        });
//        cldb.listen('load', function() {
//            try {
//                var iframe_window = db.element.contentWindow;
//                if (iframe_window.location.href === this.attributes.src) {
//                    // iframe not redirected, ldbserver successful opened
//                    return;
//                }
//            } catch(e) {}
//            // ldbserver open error
//        });
        

        if (window.indexedDB) {

            try {
                var request = window.indexedDB.open('markdown-webdocs.editor.db', 1.0); // duplication?

                request.onsuccess = function(event) { 
                    indexeddb = event.target.result;
                    onready();
                };

                request.onupgradeneeded = function(event) {
                    indexeddb = event.target.result;
                    indexeddb.createObjectStore('drafts', {keyPath: 'key'});
                    onready();
                };

                request.onerror = function(event) {
                    errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Database error. Please try using another browser for editing the document.');
                    console.log(event);
                };

                request.onblocked = function(event) {
                    errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Database blocked');
                    console.log(event);
                };

            } catch(e) {
                NoIDBError();
                return;
            }

            db.restore = function(callback) {
                try {
                    var request = indexeddb.transaction(['drafts'], 'readonly').objectStore('drafts').get(pageid);
                    request.onsuccess = function(event) {
                        var data = dataobject.data;
                        controls.extend(data, event.target.result);

                        // validate restored data
                        data.key = pageid;
                        if (!Array.isArray(data.history))
                            data.history = [];

                        restored = true;
                        modified = false;
                        if (callback)
                            callback();
                    };
                    request.onerror = function(event) {
                        console.log(event);
                    };
                } catch (e) {
                    // db scheme error
                    // todo
                }
            };

            db.write = function() {

                if (restored)

                try {
                    var store = indexeddb.transaction(['drafts'], 'readwrite').objectStore('drafts'),
                    data = dataobject.data;

                    if (data.delete) {
                        delete data.delete;
                        store.delete(pageid);
                    }
                    else
                        store.put(data);
                    
                    if (localStorage)
                        localStorage.setItem('default selected page', data.selected);

                    modified = false;
                } catch (e) {
                    console.log(e);
                    // db scheme error
                    // todo
                }
            };


        } else if (!window.openDatabase) {
            NoIDBError();
            return;
        } else {


            // web SQL engine
            try {
                var websqldb = window.openDatabase('markdown-webdocs.editor.db', '1.0', 'markdow webdocs drafts', 0);
                if (!websqldb) {
                    NoIDBError();
                    return;
                }

                // check table
                websqldb.transaction(
                    function(tx){
                        tx.executeSql(
                            'CREATE TABLE IF NOT EXISTS drafts (key TEXT NOT NULL PRIMARY KEY, value TEXT)',
                            [], null/*onsuccess*/, NoIDBError/*onerror*/);
                    },
                    NoIDBError/*onerror*/,
                    onready/*onreadytransaction*/
                );
            } catch(e) {
                NoIDBError();
                return;
            }

            db.restore = function(callback) {
                try {
                    websqldb.transaction(
                        function(tx){
                            tx.executeSql(
                                'SELECT value FROM drafts WHERE key = ? LIMIT 1',
                                [pageid],
                                /*onsuccess*/function(tx, result) {
                                    var data = dataobject.data;

                                    if (result.rows.length) {
                                        try {
                                            controls.extend(data, JSON.parse(result.rows.item(0).value));
                                        } catch (e) {}
                                    }

                                    // validate restored data
                                    if (!Array.isArray(data.history))
                                        data.history = [];

                                    restored = true;
                                    modified = false;
                                    if (callback)
                                        callback();
                                },
                                /*onerror*/function(event){
                                    console.log(event);
                                });
                        },
                        /*onerror*/function(){
                            console.log(event);
                        },
                        /*onreadytransaction*/function(){
                        }
                    );
                } catch (e) {
                    // db scheme error
                    // todo
                }
            };

            db.write = function() {
                if (restored)
                try {
                    websqldb.transaction(
                        function(tx){
                            var data = dataobject.data;
                            if (data.delete) {
                                delete data.delete;
                                tx.executeSql(
                                'DELETE FROM drafts WHERE key = ?',
                                [pageid],
                                /*onsuccess*/function(tx, result) {

                                },
                                /*onerror*/function(event){
                                    console.log(event);
                                });
                            }
                            else {
                                tx.executeSql(
                                'INSERT OR REPLACE INTO drafts (key, value) VALUES (?, ?)',
                                [pageid, JSON.stringify(data)],
                                /*onsuccess*/function(tx, result) {

                                },
                                /*onerror*/function(event){
                                    console.log(event);
                                });
                            }
                        },
                        /*onerror*/function(){
                            console.log(event);
                        },
                        /*onreadytransaction*/function(){
                        }
                    );
                    modified = false;
                } catch (e) {
                    console.log(e);
                    // db scheme error
                    // todo
                }
            };
        }
        
        db.reloadOnReady = function reload(message) {
            setTimeout(function() {
                location.reload();
            }, 400);
        };
        
        function NoIDBError() { errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Your browser does not supported and can not be used to edit documents. Please use Firefox, Chrome, Opera or Safari.'); }
    }
    

    // utilites panel
    function Utilities() {
        var utilities = controls.create('div', {class:'pad20'});
        return utilities;
    }
    
    
    function errorMessage(message) {
        // alert message
        $DOC.cbody.attachAll();
        $DOC.cbody.unshift('alert:div', {$text:message, class:'mar20 alert alert-warning col1-sm-offset-3 col-sm-6', style:'z-index:1200;'});
        $DOC.cbody.alert.createElement();
    }


}).call(function() { return this || (typeof window !== 'undefined' ? window : global); }());