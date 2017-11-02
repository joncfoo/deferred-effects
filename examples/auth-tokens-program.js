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

    while (1) {
        // actionResult :: Result UIAction
        const actionResult = yield Instruction.AwaitUIAction

        if (Result.Error.is(actionResult)) {
            yield Instruction.NotifyError(actionResult.error)
            break
        }

        const action = actionResult.value

        if (UIAction.Exit.is(action)) {
            break
        }

        if (UIAction.Delete.is(action)) {
            const tokenID = action.tokenID
            const confirmed = yield Instruction.ConfirmDeletion(tokenID)

            if (confirmed) {
                const deleteResult = yield Instruction.DeleteToken(tokenID)
                if (Result.Error.is(deleteResult)) {
                    yield Instruction.NotifyError(deleteResult.error)
                }
            }
        }

        if (UIAction.Create.is(action)) {
            const tokenName = yield Instruction.PromptNewTokenName
            const tokenResult = yield Instruction.CreateToken(tokenName)
            if (Result.Error.is(tokenResult)) {
                yield Instruction.NotifyError(tokenResult.error)
            } else {
                yield Instruction.DisplayNewToken(tokenResult.value)
            }
        }

        if (UIAction.Show.is(action)) {
            yield Instruction.DisplayAllTokens
        }
    }
})

module.exports = {
    program,
    Instruction,
    UIAction,
    Result,
    Token,
}
