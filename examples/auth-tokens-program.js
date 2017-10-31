const daggy = require('daggy')
const {Program, makeInstructions} = require('../src/index')

const Result = daggy.taggedSum('Result', {
    Error: ['error'],
    Ok: ['value'],
})

const UIAction = daggy.taggedSum('UIAction', {
    Show: [],
    Delete: ['tokenID'],
    Create: [],
    Exit: [],
})

const Token = daggy.tagged('Token', ['id', 'token'])

const Instruction = makeInstructions('Instruction', {
    // ======================
    // ==== external API ====
    // ======================

    // ListTokens :: Program (Result [Token])
    ListTokens: [],

    // DeleteToken :: Int -> Program ()
    DeleteToken: ['tokenID'],

    // CreateToken :: String -> Program Token
    CreateToken: ['tokenName'],

    // ====================
    // ==== UI-related ====
    // ====================

    // NotifyError :: String -> Program ()
    NotifyError: ['error'],

    // AwaitUIAction :: Program UIAction
    AwaitUIAction: [],

    // ConfirmDeletion :: Int -> Program ()
    ConfirmDeletion: ['tokenID'],

    // PromptNewTokenName :: Program String
    PromptNewTokenName: [],

    // DisplayNewToken :: Token -> Program ()
    DisplayNewToken: ['token'],

    // DisplayAllTokens :: Program ()
    DisplayAllTokens: [],
})

const program = Program.do(function *() {
    // tokensResult :: Result [Token]
    const tokensResult = yield Instruction.ListTokens

    // upon failure notify of error
    if (Result.Error.is(tokensResult)) {
        yield Instruction.NotifyError(tokensResult.error)
        return
    }

    // action :: UIAction
    let action = yield Instruction.AwaitUIAction

    while (!UIAction.Exit.is(action)) {

        if (UIAction.Delete.is(action)) {
            const tokenID = action.tokenID
            const confirmed = yield Instruction.ConfirmDeletion(tokenID)

            if (confirmed) {
                yield Instruction.DeleteToken(tokenID)
            }
        }

        if (UIAction.Create.is(action)) {
            const tokenName = yield Instruction.PromptNewTokenName
            const token = yield Instruction.CreateToken(tokenName)
            yield Instruction.DisplayNewToken(token)
        }

        if (UIAction.Show.is(action)) {
            yield Instruction.DisplayAllTokens
        }

        action = yield Instruction.AwaitUIAction
    }
})

module.exports = {
    program,
    Instruction,
    UIAction,
    Result,
    Token,
}
