'use strict';
const { Component, h, render } = window.preact;



class App extends Component {
  constructor(props) {
    super(props);

    this.onSave = this.onSave.bind(this);
  }

  removeEmptyObjectKeys(obj) {
    for (let key in obj) {
      let group = obj[key];
      if (group.constructor === Object && Object.keys(group).length === 0) {
        delete obj[key];
      }
    }
  }

  onSave(e) {
    let userConfigs = this.mainRef.getUserConfigs() || {};
    this.removeEmptyObjectKeys(userConfigs);

    chrome.storage.local.set({
      userConfigs: userConfigs,
    });

    let btnSave = this.headerRef.querySelector('button');
    let msgSaved = this.headerRef.querySelector('.message-saved');
    msgSaved.classList.add('show');
    btnSave.disabled = 'disabled';
    setTimeout(() => {
      msgSaved.classList.remove('show');
      btnSave.removeAttribute('disabled');
    }, 3000);

  }

  render(props, state) {
    return (
      h('div', { id: 'app' },
        h(Header, {
          ref: ref => this.headerRef = ref,
          onSave: this.onSave,
        }),
        h(Main, {
          ref: ref => this.mainRef = ref,
        })
      )
    );
  }
}



const Header = (props) => {
  const manifestData = chrome.runtime.getManifest();

  return h('header', null,
    [
      h('h1', null, [
        'Facebook Tweaker',
        h('a', {
          href: 'https://github.com/redphx/facebook-tweaker',
          target: '_blank',
        }, manifestData.version),
        h('a', {
          href: 'http://codekiem.com',
          target: '_blank',
        }, 'redphx'),
      ]),
      h('button', {
        className: 'btn-save',
        onClick: props.onSave
      }, 'Save'),
      h('p', {
        className: 'message-saved',
      }, 'Saved successfully! Refresh Facebook pages to apply new configs.'),
    ]
  );
};



const RowHeader = ({ group }) => {
  return h('div', { className: 'row row-header' },
    [
      h('div', { className: 'cell' }, group),
      h('div', { className: 'cell' }),
      h('div', { className: 'cell' }),
    ]
  );
};



const RowBoolean = ({ config, value, defaultValue, onChange, onClick }) => {
  const clsRow = 'row row-config row-boolean ' + (defaultValue !== value ? 'modified' : '');
  const clsCell = 'cell';

  return (
    h('div', { className: clsRow, onClick: onClick, },
      [
        h('div', { className: clsCell },
          h('strong', null, config)
        ),
        h('div', { className: clsCell }, value ? 'true' : 'false'),
        h('div', { className: clsCell },
          h('input', {
            type: 'checkbox',
            checked: value,
            onChange: onChange,
          })
        ),
      ]
    )
  );
};



class Main extends Component {
  sortObjectByKeys(obj) {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    let newObj = {};
    Object.keys(obj).sort().forEach(k => {
      newObj[k] = obj[k];
    });
    return newObj;
  }

  findDifferentKeys(obj) {
    chrome.storage.local.get('diffConfigs', data => {
      let currentConfigs = Object.keys(obj);
      let oldConfigs = data.diffConfigs;
      if (oldConfigs == null) {
        chrome.storage.local.set({
          diffConfigs: currentConfigs
        });
        return [];
      }

      console.log(this.getArrayDifferences(currentConfigs, oldConfigs));
      chrome.storage.local.set({
        diffConfigs: currentConfigs
      });
    });

  }

  getArrayDifferences(a1, a2) {
    var a = [], diff = [];

    for (var i = 0; i < a1.length; i++) {
      a[a1[i]] = true;
    }

    for (var i = 0; i < a2.length; i++) {
      if (a[a2[i]]) {
        delete a[a2[i]];
      } else {
        a[a2[i]] = true;
      }
    }

    for (var k in a) {
      diff.push(k);
    }

    return diff;
  }

  getUserConfigs() {
    return this.state.userConfigs;
  }

  getFbConfigs() {
    return this.state.fbConfigs;
  }

  renderConfigs() {
    let fbConfigs = this.state.fbConfigs;
    let diffConfigs = this.state.diffConfigs;
    let userConfigs = this.state.userConfigs;

    let rowViews = [];

    for (let group in fbConfigs) {
      let values = this.sortObjectByKeys(fbConfigs[group]);

      let childrenViews = [];
      for (let key in values) {
        let defaultValue = values[key];
        let value = defaultValue;
        if (userConfigs[group] && typeof userConfigs[group][key] !== 'undefined') {
          value = userConfigs[group][key];
        }

        let props = {
          group: group,
          config: key,
          value: value,
          defaultValue: defaultValue,
        };

        if (typeof defaultValue === 'boolean') {
          props.onChange = (e) => {
            if (!userConfigs[group]) {
              userConfigs[group] = {};
            }
            const checked = e.target.checked;
            if (checked === defaultValue) {
              delete userConfigs[group][props.config];
            } else {
              userConfigs[group][props.config] = checked;
            }

            this.setState({
              userConfigs: userConfigs,
            });
          };

          props.onClick = (e) => {
            if (e.target.nodeName !== 'INPUT') {
              e.currentTarget.querySelector('input').click();
            }
          };

          childrenViews.push(h(RowBoolean, props));
        }
        // TODO: add support for string, number, object...
      }

      if (childrenViews.length > 0) {
        rowViews.push(h(RowHeader, { group: group }));
        rowViews = rowViews.concat(childrenViews);
      }
    }

    const tableView = h('div', { className: 'table' }, rowViews);

    return tableView;
  }

  componentDidMount() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.cmd === 'configs') {
        chrome.storage.local.get('userConfigs', data => {
          document.body.classList.remove('no-config');
          this.setState({
            fbConfigs: this.sortObjectByKeys(request.fbConfigs),
            diffConfigs: this.findDifferentKeys(request.fbConfigs),
            userConfigs: this.sortObjectByKeys(data.userConfigs)
          });
        });
      }
    });
  }

  render() {
    if (!this.state.fbConfigs) {
      return h('div', { className: 'error' }, 'You need to open this page from Facebook');
    }

    let configsViews = this.renderConfigs();
    return (
      h('main', null, configsViews)
    );
  }
}


render(h(App), document.body);
