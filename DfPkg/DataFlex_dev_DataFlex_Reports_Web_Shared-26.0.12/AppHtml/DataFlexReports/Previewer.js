const DR = {}

if (!self.DR) {
    self.DR = DR;
}

DR.sVersion = "26.0.0.260";

DFERR_DATAFLEX_REPORTS = 4425;

C_TBCENTER = 0;
C_TBRIGHT = 1;
C_TBLEFT = 2;

DR.WebReportViewer = class WebReportViewer extends df.WebHtmlBox {
    constructor(oDef, oParent) {
        super(oDef, oParent);

        // Get the server version of the control
        this.prop(df.tString, "psVersion", "");

        this.prop(df.tInt, "piZoom", 100);
        this.prop(df.tInt, "piPage", 0);
        this.prop(df.tInt, "piPageCount", 0);

        this.prop(df.tBool, "pbShowToolbar", true);
        this.prop(df.tBool, "pbShowPrintButton", true);
        this.prop(df.tBool, "pbShowExportButton", false);

        this.event("OnOpenReport", df.cCallModeDefault);
        this.event("OnPageChange", df.cCallModeDefault);
        this.event("OnClickActionLink", df.cCallModeWait);
        this.event("OnExportReport", df.cCallModeWait);

        this.prop(df.tInt, "peToolbarAlignment", 0);

        this.prop(df.tInt, "peMode", 0);

        this.addSync('piPage');
        this.addSync('piPageCount');

        this._sReportHtml = null;

        this._eViewHtml = null;
        this._eViewBody = null;
        this._eViewFrame = null;
        this._eViewPort = null;
        this._eViewSizer = null;
        this._eToolbar = null;
        this._eToolbarTotalPages = null;
        this._eToolbarCurrentPageInput = null;
        this._eToolbarPrintButton = null;
        this._eToolbarExportButton = null;

        this._aPages = null;

        this._sControlClass = "DRViewer";
    }

    /*
    During object creation check if the server version of the control matches with the client version
    */
    create() {
        super.create();

        if (this.psVersion != DR.sVersion) {
            throw new df.Error(DFERR_DATAFLEX_REPORTS, "Version number mismatch in the DataFlex Reports previewer.\nClient: {{0}}. \nServer: {{1}}. \n \nRefresh your cache to update the control.", this, [DR.sVersion, this.psVersion]);
        }
    }

    /*
    This method augments the html generation and adds the viewer element and optionally a tool-bar.
    
    @param  aHtml   String builder array containing html.
    
    @private
    */
    openHtml(aHtml) {
        super.openHtml(aHtml);

        if (this.pbShowToolbar) {
            aHtml.push(this.createToolbar());
        }

        aHtml.push('<div class="DR_Frame DR_Body">');
        aHtml.push('<div class="DR_Print"></div>');
        aHtml.push('<div class="DR_Screen">');
        aHtml.push('<div class="DR_ViewPort">');
        aHtml.push('<div class="DR_Sizer">');
    }

    /*
    This method augments the html generation and closes the viewer element.
    
    @param  aHtml   String builder array containing html.
    
    @private
    */
    closeHtml(aHtml) {
        aHtml.push('</div>');
        aHtml.push('</div>');
        aHtml.push('</div>');
        aHtml.push('</div>');

        super.closeHtml(aHtml);
    }

    afterRender() {
        super.afterRender();

        this.initViewer();
    }

    resizeHorizontal() {
        var i;

        //  Call children
        for (i = 0; i < this._aChildren.length; i++) {
            if (this._aChildren[i] instanceof df.WebBaseUIObject && !(this._aChildren[i] instanceof df.WebView)) { //  Skip views, they are called by the WebApp
                if (this._aChildren[i].pbRender && this._aChildren[i].resizeHorizontal) {
                    this._aChildren[i].resizeHorizontal();
                }
            }
        }
    }


    isCommonCSSLoaded() {
        var eHead, eStyle;

        eHead = document.head || document.getElementsByTagName("head")[0];
        if (eHead && !document.getElementById("DR_PreviewerCommonStyle")) {
            eStyle = document.createElement("style");
            eStyle.id = "DR_PreviewerCommonStyle";
            eStyle.type = "text/css";
            eStyle.appendChild(document.createTextNode([
                "@page{margin:0pt;}",
                " :root{--dr-viewer-background:#efefef;--dr-page-background:#ffffff;--dr-page-shadow:1px 5px 18px rgba(0,0,0,0.2);}",
                "body.df-Dark{--dr-viewer-background:#1f2327;--dr-page-shadow:1px 5px 18px rgba(0,0,0,0.45);}",
                "@media screen{.DR_Frame.DR_Body{background-color:var(--dr-viewer-background);margin:0;}.DR_Frame .page{margin:20px 10px 30px;-webkit-box-shadow:var(--dr-page-shadow);-moz-box-shadow:var(--dr-page-shadow);box-shadow:var(--dr-page-shadow);background-color:var(--dr-page-background);}}",
                "@media print{body.DR_Printing{margin:0;}body.DR_Printing *{visibility:hidden !important;}body.DR_Printing .DR_Print,body.DR_Printing .DR_Print *{visibility:visible !important;}body.DR_Printing .DR_Print{display:block !important;position:absolute !important;left:0;top:0;}body.DR_Printing .DR_Screen,body.DR_Printing .DR_Toolbar{display:none !important;}body.DR_Printing .DR_Print .page{page-break-inside:avoid;page-break-after:always;display:inline-block;}body.DR_Printing .DR_Print .page:last-child{page-break-after:avoid;}}",
                ".DR_Frame .page,.DR_Print .page{position:relative;width:628pt;height:852pt;}",
                ".DR_Frame .DR_ViewPort{overflow:hidden;position:relative;}",
                ".DR_Frame .DR_Click{ text-decoration:underline;cursor:pointer;}",
                ".DR_Frame .DR_Sizer{position:absolute;}"
            ].join("")));
            eHead.appendChild(eStyle);
        }
    }

    initViewer() {
        this.isCommonCSSLoaded();

        this._eViewFrame = df.dom.query(this._eElem, "div.DR_Frame");
        this._eViewBody = this._eViewFrame;
        this._eViewWindow = this._eViewFrame;
        this._eViewPrint = df.dom.query(this._eViewBody, "div.DR_Print");
        this._eViewScreen = df.dom.query(this._eViewBody, "div.DR_Screen");
        this._eViewPort = df.dom.query(this._eViewBody, "div.DR_ViewPort");
        this._eViewSizer = df.dom.query(this._eViewBody, "div.DR_Sizer");

        this._eViewFrame.style.overflow = "auto";
        this._eViewFrame.style.boxSizing = "border-box";
        this._eViewPrint.style.display = "none";

        if (this._sReportHtml) {
            this.refreshPreview();
        }

        if (this.pbShowToolbar) {
            this.initToolbar();
            //remove the opacity so the tool-bar disappears
            this._eToolbar.style.opacity = "";
            this.updateToolbar();
        }

        df.events.addDomListener("scroll", this._eViewWindow, this.onScroll, this);
        df.events.addDomListener("click", this._eViewSizer, this.clickActionLink, this);
    }

    createToolbar() {
        var aToolbarHtml = [];

        switch (this.peToolbarAlignment) {
            case C_TBRIGHT:
                aToolbarHtml.push('<div class="DR_Toolbar" style="opacity:1; right: 0px; padding-right: 0px">');
                break;
            case C_TBLEFT:
                aToolbarHtml.push('<div class="DR_Toolbar" style="opacity:1; margin-left: 0px; left: 0px;">');
                break;
            default:
                aToolbarHtml.push('<div class="DR_Toolbar" style="opacity:1; left: 50%;">');
                break;
        }

        aToolbarHtml.push('<div class="DR_Inner clearfix">');

        aToolbarHtml.push('<div class="DR_Wrapper ', (this.pbShowPrintButton ? '' : 'DR_Hidden'), '">');
        aToolbarHtml.push('<div class="DR_PrintButton"></div>');
        aToolbarHtml.push('</div>');

        aToolbarHtml.push('<div class="DR_Separator ', (this.pbShowPrintButton ? '' : 'DR_Hidden'), '"></div>');

        aToolbarHtml.push('<div class="DR_Wrapper ', (this.pbShowExportButton ? '' : 'DR_Hidden'), '">');
        aToolbarHtml.push('<div class="DR_ExportButton"></div>');
        aToolbarHtml.push('</div>');

        aToolbarHtml.push('<div class="DR_Separator ', (this.pbShowExportButton ? '' : 'DR_Hidden'), '"></div>');
        aToolbarHtml.push('<div class="DR_Wrapper">');
        aToolbarHtml.push('<div class="DR_PreviousButton"></div>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('<div class="DR_Wrapper">');
        aToolbarHtml.push('<div class="DR_NextButton"></div>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('<div class="DR_Separator"></div>');
        aToolbarHtml.push('<div class="DR_PageIndicator">');
        aToolbarHtml.push('<input type="text" size="1px" class="DR_CurrentPage" value="0"/>');
        aToolbarHtml.push('<p class="DR_PageSeparator">/</p>');
        aToolbarHtml.push('<p class="DR_LastPage">', this.get_piPageCount(), '</p>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('<div class="DR_Separator"></div>');
        aToolbarHtml.push('<div class="DR_Wrapper">');
        aToolbarHtml.push('<div class="DR_ZoomOutButton"></div>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('<div class="DR_Wrapper">');
        aToolbarHtml.push('<div class="DR_ZoomInButton"></div>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('</div>');
        aToolbarHtml.push('</div>');

        return aToolbarHtml.join("");
    }

    initToolbar() {
        var eButton = null;

        this._eToolbar = df.dom.query(this._eElem, "div.DR_Toolbar");
        this._eToolbarTotalPages = df.dom.query(this._eToolbar, "p.DR_LastPage");
        this._eToolbarCurrentPageInput = df.dom.query(this._eToolbar, "input.DR_CurrentPage");
        this._eToolbarPrintButton = df.dom.query(this._eToolbar, "div.DR_PrintButton");
        this._eToolbarExportButton = df.dom.query(this._eToolbar, "div.DR_ExportButton");

        //print button
        if (this.pbShowPrintButton && this._eToolbarPrintButton) {
            df.events.addDomListener("click", this._eToolbarPrintButton, this.printReport, this);
        }

        //export button
        if (this.pbShowExportButton && this._eToolbarExportButton) {
            df.events.addDomListener("click", this._eToolbarExportButton, this.exportReport, this);
        }

        // Previous button
        eButton = df.dom.query(this._eToolbar, "div.DR_PreviousButton");
        if (eButton) {
            df.events.addDomListener("click", eButton, this.previousPage, this);
        }

        // Next button
        eButton = df.dom.query(this._eToolbar, "div.DR_NextButton");
        if (eButton) {
            df.events.addDomListener("click", eButton, this.nextPage, this);
        }

        // Zoom in button
        eButton = df.dom.query(this._eToolbar, "div.DR_ZoomOutButton");
        if (eButton) {
            df.events.addDomListener("click", eButton, this.zoomOut, this);
        }

        // Zoom out button
        eButton = df.dom.query(this._eToolbar, "div.DR_ZoomInButton");
        if (eButton) {
            df.events.addDomListener("click", eButton, this.zoomIn, this);
        }

        if (this._eToolbarCurrentPageInput) {
            df.events.addDomListener("click", this._eToolbarCurrentPageInput, this.currentPageClick, this);

            df.events.addDomListener("focus", this._eToolbarCurrentPageInput, function () {
                df.events.addDomKeyListener(this._eToolbarCurrentPageInput, this.onKey, this);
            }, this);

            df.events.addDomListener("blur", this._eToolbarCurrentPageInput, function () {
                df.events.removeDomKeyListener(this._eToolbarCurrentPageInput, this.onKey, this);
                this._eToolbarCurrentPageInput.value = this.get_piPage();
                df.dom.removeClass(this._eToolbar, "active");
            }, this);
        }
    }

    updateToolbar() {
        if (this._eToolbar) {
            this._eToolbarCurrentPageInput.value = this.get_piPage();
            this._eToolbarTotalPages.innerHTML = this.get_piPageCount();
        }
    }

    currentPageClick() {
        df.dom.addClass(this._eToolbar, "active");
        this._eToolbarCurrentPageInput.focus();
        this._eToolbarCurrentPageInput.select();
    }

    onKey(oEvent) {
        if (oEvent.getKeyCode() === 13) {
            this.updateCurrentPage(this._eToolbarCurrentPageInput.value);
        }
    }

    refreshPreview() {
        if (this._eViewSizer) {
            this._eViewSizer.innerHTML = this._sReportHtml;
            this.recalcSize();

            this._aPages = df.dom.query(this._eViewSizer, "div.page", true);
        }
    }

    updateCurrentPage(iNewPage) {
        if (iNewPage) {
            if (iNewPage > this.get_piPageCount()) {
                iNewPage = this.get_piPageCount();
            } else if (iNewPage < 1) {
                iNewPage = 1;
            }
            this.set_piPage(iNewPage);
        }

        this.updateToolbar();
    }

    nextPage() {
        var iCurrentPage = this.get_piPage();

        if (iCurrentPage !== this.get_piPageCount()) {
            iCurrentPage++;
            this.set_piPage(iCurrentPage);
            if (this._eToolbarCurrentPageInput) {
                this._eToolbarCurrentPageInput.value = iCurrentPage;
            }
        }
    }

    previousPage() {
        var iCurrentPage = this.get_piPage();

        if (iCurrentPage !== 1) {
            iCurrentPage--;
            this.set_piPage(iCurrentPage);
            if (this._eToolbarCurrentPageInput) {
                this._eToolbarCurrentPageInput.value = iCurrentPage;
            }
        }
    }

    zoomIn() {
        this.piZoom += 10;
        this.set_piZoom(this.piZoom);
    }

    zoomOut() {
        if (this.piZoom !== 10) {
            this.piZoom -= 10;
            this.set_piZoom(this.piZoom);
        }
    }

    showReport() {
        var i, j, aReportData, aPageData, reportHtml = "";

        if (this.peMode === 0) {
            aReportData = this._tActionData.c;
            if (aReportData.length > 0) {
                for (i = 0; i < aReportData.length; i++) {
                    aPageData = df.sys.vt.deserialize(aReportData[i], [df.tString]);
                    for (j = 0; j < aPageData.length; j++) {
                        reportHtml += aPageData[j];
                    }
                }
                this._sReportHtml = reportHtml;
                this.refreshPreview();
                this.piPage = this.get_piPage();
                this.fire('OnOpenReport');

                this.updateToolbar();
            } else {
                throw new df.Error(DFERR_DATAFLEX_REPORTS, "No HTML data received.");
            }
        } else {
            aReportData = df.sys.vt.deserialize(this._tActionData, [df.tString]);
            if (aReportData.length > 0) {
                const firstImage = new Image();
                const self = this;
                firstImage.onload = function () {
                    const isLandscape = firstImage.width > firstImage.height;
                    let reportHtml = "";
                    for (let i = 0; i < aReportData.length; i++) {
                        const src = aReportData[i];
                        const extraAttrs = isLandscape ? " data-orientation='landscape' style='position: relative;width: 852pt;height: 628pt;'" : "data-orientation='portrait' style='position: relative;'";
                        reportHtml += "<div class='page'" + extraAttrs + " >";
                        reportHtml += "<img src='" + src + "' width='100%' height='100%'>";
                    reportHtml += "</div>";
                }
                    self._sReportHtml = reportHtml;
                    self.refreshPreview();
                    self.piPage = self.get_piPage();
                    self.fire('OnOpenReport');
                    self.updateToolbar();
                };
                firstImage.onerror = function () {
                    throw new df.Error(DFERR_DATAFLEX_REPORTS, "Failed to load first image for orientation check.");
                };
                firstImage.src = aReportData[0];
            } else {
                throw new df.Error(DFERR_DATAFLEX_REPORTS, "No image data received.");
            }
        }
    }

    clickActionLink(oEvent) {
        var eElem = oEvent.getTarget(), vDataType, sData = null;

        while (eElem && eElem !== this._eViewSizer) {
            if (eElem.className === "DR_Click") {
                vDataType = eElem.getAttribute("data-drtype");
                sData = df.dom.getText(eElem);
                this.fire('OnClickActionLink', [sData, vDataType]);
                return false;
            }
            eElem = eElem.parentNode;
        }
    }

    printReport() {
        if (this._aPages && this._aPages.length > 0) {
            var that = this;

            this._eViewScreen.style.display = "none";
            this._eViewPrint.innerHTML = this._sReportHtml;
            this._eViewPrint.style.display = "";

            if (this.peMode === 0) {
                that.doPrint();
            } else {
                if (this._eViewSizer) {
                    var iPages = df.dom.query(this._eViewSizer, "img", true).length;
                    setTimeout(function () {
                        that.doPrint();
                    }, iPages >= 2 ? iPages * 50 : 100);
                }
            }
        } else {
            throw new df.Error(DFERR_DATAFLEX_REPORTS, "Nothing to print!", this);
        }
    }

    exportReport() {
        this.fire("OnExportReport")
    }

    doPrint() {
        df.dom.addClass(document.body, "DR_Printing");
        window.focus();
        window.print();
        df.dom.removeClass(document.body, "DR_Printing");

        this._eViewPrint.style.display = "none";
        this._eViewScreen.style.display = "";
    }

    set_piZoom(iVal) {
        var sTransform, nScale, eElem = this._eViewSizer;

        if (this._eViewSizer && this._eViewPort) {
            nScale = iVal / 100;
            sTransform = "scale(" + nScale + ", " + nScale + ")";

            if (typeof (this._eViewPort.style.transform) !== "undefined") {
                eElem.style.transform = sTransform;
            } else if (typeof (eElem.style.WebkitTransform) !== "undefined") {
                eElem.style.WebkitTransform = sTransform;
            } else if (typeof (eElem.style.msTransform) !== "undefined") {
                eElem.style.msTransform = sTransform;
            } else if (typeof (eElem.style.MozTransform) !== "undefined") {
                eElem.style.MozTransform = sTransform;
            } else if (typeof (eElem.style.OTransform) !== "undefined") {
                eElem.style.OTransform = sTransform;
            }
            this.piZoom = iVal;
            this.recalcSize();
        }
    }

    set_piPage(iPage) {
        var iScroll = 0;

        if (this._aPages && this._aPages.length > 0 && this._eViewWindow) {
            iPage--;
            if (iPage < 0) {
                iPage = 0;
            } else {
                if (iPage >= this._aPages.length) {
                    iPage = this._aPages.length;
                    iPage--;
                }
            }
            iScroll = Math.round(this._aPages[iPage].offsetTop * (this.piZoom / 100));
            this._eViewWindow.scrollTop = iScroll;
        }
    }

    get_piPage() {
        var iPage = 0, iScroll, iDivider = 1;

        if (this._aPages && this._aPages.length > 0 && this._eViewWindow) {
            iScroll = this._eViewWindow.scrollTop;

            iDivider = (this._aPages[0].offsetHeight * (this.piZoom / 100));
            iPage = Math.floor(iScroll / iDivider) + 1;

            if (iPage > this._aPages.length) {
                iPage = this._aPages.length;
            }
        }
        
        if (Number.isNaN(iPage)) {
            iPage = 1 ;
        }

        return iPage;
    }

    get_piPageCount() {
        if (this._aPages) {
            return this._aPages.length;
        }
        return 0;
    }

    recalcSize() {
        var that = this;

        if (this.peMode === 0) {
            setTimeout(function () {
                that.doRecalcSize();
            }, 20);
        }
        else {
            if (this._eViewSizer) {
                var iPages = df.dom.query(this._eViewSizer, "img", true).length;
                setTimeout(function () {
                    that.doRecalcSize();
                }, iPages >= 2 ? iPages * 50 : 100);
            }
        }
    }

    doRecalcSize() {
        var iTopOffset, iZoomHeight, iZoomWidth, iRealHeight, iRealWidth, iLeftOffset, iCenterOffset;

        if (this._eViewPort) {
            iRealHeight = this._eViewSizer.clientHeight;
            iRealWidth = this._eViewSizer.clientWidth;

            if (iRealHeight > 0 && iRealWidth > 0) {
                iZoomHeight = (iRealHeight * (this.piZoom / 100));
                iZoomWidth = (iRealWidth * (this.piZoom / 100));

                iTopOffset = (iZoomHeight - iRealHeight) / 2;
                iLeftOffset = (iZoomWidth - iRealWidth) / 2;

                this._eViewSizer.style.top = iTopOffset + "px";
                this._eViewSizer.style.left = iLeftOffset + "px";

                this._eViewPort.style.height = iZoomHeight + "px";
                this._eViewPort.style.width = iZoomWidth + "px";

                iCenterOffset = (this._eViewPort.parentNode.clientWidth - iZoomWidth) / 2;

                this._eViewPort.style.marginLeft = (iCenterOffset > 0 ? iCenterOffset + "px" : "");

                // Fix center and not displaying last page in full by setting the zoom value again
                this.set_piZoom(this.piZoom);
            }
        }
    }

    onScroll(oEvent) {
        if (this.get_piPage() !== this.piPage) {
            this.piPage = this.get_piPage;
            this.fire('OnPageChange');
            this.updateToolbar();
        }
    }

    updateHtml() {
    }

    set_pbShowPrintButton(bVal) {
        if (this._eToolbarPrintButton) {
            df.dom.toggleClass(this._eToolbarPrintButton.parentNode, "DR_Hidden", bVal);
        }
    }

    set_pbShowToolbar(bVal) {
        if (this._eControl) {
            if (bVal) {
                if (!this._eToolbar) {
                    this._eToolbar = df.dom.create(this.createToolbar());
                    if (this._eControl.firstChild) {
                        this._eControl.insertBefore(this._eToolbar, this._eControl.firstChild);
                    } else {
                        this._eControl.appendChild(this._eToolbar);
                    }
                    this.initToolbar();
                    this.updateToolbar();
                    //remove the opacity so the tool-bar disappears
                    this._eToolbar.style.opacity = "";
                } else {
                    df.dom.removeClass(this._eToolbar, "invisible");
                }
            } else if (this._eToolbar) {
                df.dom.addClass(this._eToolbar, "invisible");
            }
        }
    }
}
