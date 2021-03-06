import React from 'react';
import $ from 'jquery';
import Caret from './caret';
import { Mode } from './core/constants';
import { defaultIfNull } from './core/utils';

export default class Surface extends React.Component {
  constructor(props) {
    super(props);
    this.setSurface(props.surface);
  }

  componentWillReceiveProps(props) {
    this.setSurface(props.surface);
  }

  setSurface(surface) {
    this.surface = surface;
    surface.onScrollDown = this.onScrollDown;
    surface.onScrollUp = this.onScrollUp;
    surface.onRowsChange = this.updateScreenRows;
    surface.onPutTop = this.onPutTop;
    surface.onPutCenter = this.onPutCenter;
    surface.onPutBottom = this.onPutBottom;
    surface.onPageDown = this.onPageDown;
    surface.onPageUp = this.onPageUp;
  }

  activate = () => {
    this.updateCaretPosition();
    this.caret.show();
  }

  deactivate = () => {
    this.caret.hide();
  }

  componentDidMount = () => {
    this.updateScreenRows();
  }

  updateScreenRows() {
    const viewDiv = $(this.viewDiv);
    if (viewDiv.hasClass('content')) {
      const surfaceHeight = viewDiv.height();
      this.surfaceHeight = surfaceHeight;
      const lines = viewDiv.find('.line');
      let lastRow = 0;
      for (let row = 0; row < lines.length; ++row) {
        const line = lines[row];
        if (line.offsetTop > surfaceHeight) {
          break;
        }
        lastRow = row;
      }
      this.firstRow = 0;
      this.lastRow = lastRow;
      this.rowLeading = lines[0].offsetTop / 2;
      this.rows = this.lastRow - this.firstRow + 1;
    }
  }

  componentDidUpdate = () => {
    this.updateCaretPosition();
  }

  render() {
    const classes = [this.props.className];
    if (this.surface.active) classes.push('active');
    return (
      <div
        className={['view', ...classes].join(' ')}
        ref={ref => this.viewDiv = ref}
      >
        <div
          className="text"
          ref={ref => this.textDiv = ref}
        >
          {this.renderContent(this.surface.content)}
        </div>
        <Caret ref={ref => this.caret = ref}/>
      </div>
    );
  }

  onScrollDown = (rows) => {
    rows = rows || 1;
    if (this.firstRow + rows > this.surface.content.lastRow()) return;
    this.firstRow += rows;
    this.lastRow += rows;
    this._doScroll();
    const caret = this.surface.caret;
    if (caret.row < this.firstRow) {
      caret.setRow(this.firstRow);
    }
  }

  onScrollUp = (rows) => {
    rows = rows || 1;
    if (this.firstRow - rows < 0) return;
    this.firstRow -= rows;
    this.lastRow -= rows;
    this._doScroll();
    const caret = this.surface.caret;
    if (caret.row > this.lastRow) {
      caret.setRow(this.lastRow);
    }
  }

  onPageDown = () => {
    this.onScrollDown(this.rows);
  }

  onPageUp = () => {
    this.onScrollUp(this.rows);
  }

  _doScroll(row) {
    // this implementation can't handle scroll over last line
    // i.e. we can't place last row on first screen row
    row = defaultIfNull(row, this.firstRow);
    this.firstRow = row;
    const viewDiv = $(this.viewDiv);
    const line = viewDiv.find('.line').get(row);
    this.viewDiv.scrollTop = line.offsetTop - this.rowLeading;
  }

  onPutTop = () => {
    this._doScroll(this.surface.caret.row);
  }

  onPutCenter = () => {
    let row = this.surface.caret.row;
    row = row - Math.floor(this.rows / 2);
    if (row >= 0) {
      this._doScroll(row);
    }
  }

  onPutBottom = () => {
    let row = this.surface.caret.row - this.rows + 1;
    if (row >= 0) {
      this._doScroll(row);
    }
  }

  renderContent = (content) => {
    const lineComponents = [];
    content.lines.forEach((line, iLine) => {
      if (lineComponents.length) {
        lineComponents.push(<br key={'br' + iLine}/>);
      }
      lineComponents.push(this.renderLine(line, iLine));
    });
    return lineComponents;
  }

  renderLine = (line, iLine) => {
    if (line.text().length === 0) {
      return this.renderDummyLine(iLine);
    } else {
      const spans = line.spans.map(this.renderElem);
      return (
        <span className="line" key={iLine}>
          {spans}
        </span>
      );
    }
  }

  renderDummyLine = (iLine) => {
    return (
      <span className="line dummy" key={iLine}>
        {this.renderDummyElem()}
      </span>
    );
  }

  renderElem = (span, iElem) => {
    const classes = [];
    if (span.attrs.highlighted) {
      classes.push('highlighted');
    }
    if (span.attrs.selected) {
      classes.push('selected');
    }
    return (
      <span
        className={['elem', ...classes].join(' ')}
        key={iElem}
      >
        {span.text}
      </span>
    );
  }

  renderDummyElem = (iElem) => {
    return <span className="elem dummy" key={iElem}> </span>;
  }

  updateCaretPosition = () => {
    const rect = this.getCharRect(this.surface.caret);
    const caret = this.caret;
    let caretWidth;
    if (this.surface.isIn(Mode.Input)) {
      caretWidth = 1;
      caret.setBlock(false);
      caret.setBlink(true);
    } else {
      caretWidth = rect.width;
      caret.setBlock(true);
      caret.setBlink(false);
    }
    caret.setPosition(rect.left, rect.top);
    caret.setWidth(caretWidth);
    // 2018-07-22 22:58:07
    // to handle regression that input-element won't move along with caret
    if (rect.y) {  
      $(this.props.input).css({
        left: rect.x,
        top: rect.y,
      });
    }
    const row = this.surface.caret.row;
    if (row > this.lastRow) {
      this.onScrollDown(row - this.lastRow);
    } else if (row < this.firstRow) {
      this.onScrollDown(row - this.firstRow);
    }
  }

  getCharRect = ({row, col}) => {
    const lineNode = $(this.textDiv).find('.line').get(row);
    const elemNodes = lineNode.children;
    let begCol = 0;
    let elemNode, textNode, offset;
    for (let i = 0; i < elemNodes.length; ++i) {
      elemNode = elemNodes[i];
      offset = col - begCol;
      textNode = elemNode.firstChild;
      const elemText = $(elemNode).text();
      const endCol = begCol + elemText.length;
      if (begCol <= col && col < endCol) {
        return this.getTextNodeRect(textNode, offset, offset + 1);
      }
      begCol = endCol;
    };
    return this.getTextNodeRect(textNode, offset, offset);
  }

  getTextNodeRect = (textNode, beg, end) => {
    const viewDiv = this.viewDiv;
    const viewRect = viewDiv.getBoundingClientRect();
    const range = new Range();
    range.setStart(textNode, beg);
    range.setEnd(textNode, end);
    const charRect = range.getBoundingClientRect();
    const x = charRect.x - viewRect.x;
    const y = charRect.y - viewRect.y;
    return {
      x: viewDiv.offsetLeft + x,
      y: viewDiv.offsetTop + y,
      left: x + viewDiv.scrollLeft,
      top: y + viewDiv.scrollTop,
      right: x + charRect.width,
      bottom: y + charRect.height,
      width: charRect.width,
      height: charRect.height,
    };
  }
}
