require('babel-polyfill')

const m = require('mithril')
const daggy = require('daggy')
const Future = require('fluture')
const {program, Instruction, UIAction, Result, Token} = require('./auth-tokens-program')

// RemoteData represents the various states that remote data can be in.
const RemoteData = daggy.taggedSum('RemoteData', {
    NotAsked: [],
    Loading: [],
    Failed: ['error'],
    Loaded: ['value'],
})

// Our "data store"
function Store(tokens) {
    this.tokens = tokens
}

Store.prototype.fetchTokens = function() {
    return Future.of(Result.Ok(this.tokens))
}

Store.prototype.createToken = function(tokenName) {
    if (tokenName.length < 8) {
        return Future.of(Result.Error('Token name must be 8 or more characters'))
    }

    // generate a new ID: max value + 1
    const newID = this.tokens.map(t => t.id).reduce((i2, i) => i > i2 ? i : i2, 0) + 1
    const newName = '****' + tokenName.substr(tokenName.length - 4, 4)
    const token = Token(newID, newName)
    this.tokens.push(token)

    // simulate work
    return Future.after(1000, Result.Ok(token))
}

Store.prototype.removeToken = function(tokenID) {
    const i = DataStore.tokens.findIndex(t => t.id === tokenID)
    if (i < 0) {
        return Future.of(Result.Error(`Invalid token ID: ${tokenID}`))
    } else {
        this.tokens = this.tokens.filter(t => t.id !== tokenID)
        return Future.of(Result.Ok({}))
    }
}


const DataStore = new Store([
    Token(1, '****abcd'),
    Token(2, '****efgh'),
    Token(3, '****ijkl'),
    Token(4, '****mnop'),
])


const EffectsInterpreter = {
    Return: (value) =>
        Future.of(value),

    ListTokens: () =>
        DataStore.fetchTokens().chain(data => {
            const tokens$ = data.cata({
                Error: (error) =>
                    RemoteData.Failed(error),
                Ok: (value) =>
                    RemoteData.Loaded(value),
            })
            AuthTokens.viewModel.tokens$ = tokens$
            m.redraw()
            return Future.of(tokens$)
        }),

    NotifyError: (error) =>
        Future.of(alert('Oops: ' + error)),

    AwaitUIAction: () =>
        Future((_, resolve) => {
            AuthTokens.actionResolver = resolve
        }),

    ConfirmDeletion: (tokenId) =>
        Future.of(confirm('Are you sure you want to delete token ' + tokenId)),

    DeleteToken: (tokenId) =>
        DataStore.removeToken(tokenId).chain(data => {
            // such hacks, wow!
            AuthTokens.viewModel.tokens$ = RemoteData.Loaded(DataStore.tokens)
            m.redraw()
            return Future.of(data)
        }),

    PromptNewTokenName: () =>
        Future((_, resolve) => {
            const name = prompt('New token name:') || ''
            resolve(name)
        }),

    CreateToken: (tokenName) =>
        DataStore.createToken(tokenName),

    DisplayNewToken: (token) =>
        Future((_, resolve) => {
            AuthTokens.viewModel.tokens$ = RemoteData.Loaded(DataStore.tokens)
            m.redraw()
            resolve({})
        }),
}

const AuthTokens = {
    // will be set by interpreter
    actionResolver: null,

    viewModel: {
        tokens$: RemoteData.NotAsked,
    },

    eventDispatcher(action) {
        AuthTokens.actionResolver(Result.Ok(action))
    },

    view() {
        const tokenView = ({id, token}) =>
              m('li', {key: id}, [
                  token,
                  m('button', {onclick: () => AuthTokens.eventDispatcher(UIAction.Delete(id))}, 'X'),
              ])

        const tokensView =
              AuthTokens.viewModel.tokens$.cata({
                  NotAsked: () =>
                      m('div', 'Initializing...'),

                  Loading: () =>
                      m('div', 'Loading...'),

                  Failed: (error) =>
                      m('div', 'Failed to load tokens: ' + error),

                  Loaded: (value) => {
                      const tokensList = m('ul', value.map(tokenView))

                      return m('div', [
                          m('button', {onclick: () => AuthTokens.eventDispatcher(UIAction.Create)}, 'Create token'),
                          tokensList,
                      ])
                  },
              })

        return m('div', [
            m('h1', 'Auth Tokens'),
            m('.tokens', tokensView),
        ])
    }
}

document.addEventListener('DOMContentLoaded', () => {
    m.mount(document.querySelector('#auth-tokens'), AuthTokens)

    program.interpretM(EffectsInterpreter)
        .fork(
            error => {
                console.error('Program error:', error)
            },
            value => {
                console.log('Program returned:', value.toString())
            }
        )
});
