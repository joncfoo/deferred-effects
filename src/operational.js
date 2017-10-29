// Port of `operajonal` - https://github.com/phipsgabler/operajonal

const daggy = require('daggy')

// ProgramView represents a generic representation of all computable programs -
// used to interpret `Program`s.
const ProgramView =
      daggy.taggedSum('ProgramView', {
          // Return is a constructor that holds a `value` to return.
          Return: ['value'],

          // Continue is a constructor that holds the current `instruction` and
          // the next action of program - the `continuation`.
          Continue: ['instruction', 'continuation'],
      })

// expose constructors of ProgramView
const {Return, Continue} =
      ProgramView


// Program is an internal representation of free programs over instructions.
const Program =
      daggy.taggedSum('Program', {
          // Lift is a constructor that promotes/lifts a `value` into the
          // Program.
          Lift: ['value'],

          // Bind is a constructor that holds the current `action` and the next
          // action - the `continuation`.
          Bind: ['action', 'continuation'],

          // Instr is a constructor that holds the current instruction.
          Instr: ['instruction'],
      })

// expose constructors of Program
const {Lift, Bind, Instr} =
      Program


// Program.of :: a -> Program a
Program.of = value => Lift(value)

// Program.emit :: a -> Program a
Program.emit = instruction => Instr(instruction)

// Program.prototype.chain :: Program a ~> (a -> Program b) -> Program b
Program.prototype.chain = function(f) {
    return Bind(this, f)
}

// Program.prototype.andThen :: Program a ~> (() -> Program b) -> Program b
Program.prototype.andThen = function(f) {
    return Bind(this, () => f)
}

// Program.prototype.map :: Program a ~> (a -> b) -> Program b
Program.prototype.map = function(f) {
    return Bind(this, a => Program.of(f(a)))
}

// Program.prototype.toProgramView converts the `Program` to the generic
// `ProgramView`.
Program.prototype.toProgramView = function() {
    return this.cata({
        // 1-1 conversion
        Lift: (value) =>
            Return(value),
        // pass instruction onwards to empty program (nothing to do)
        Instr: (instruction) =>
            Continue(instruction, Program.of),
        // convert the action accordingly
        Bind: (action, continuation) =>
            action.cata({
                // pass current value on to the continuation directly.
                // note: strict evaluation
                Lift: (value) =>
                    continuation(value).toProgramView(),
                // capture the instruction in `Continue` along with the
                // continuation
                Instr: (instruction) =>
                    Continue(instruction, continuation),
                // result of action2 (when iterpreted) will be passed to
                // continuation2 and then on to continuation. Note: Bind wraps
                // an action and as such the "first" action is the innermost
                // (action2, continuation2).
                Bind: (action2, continuation2) =>
                    Bind(action2,
                         result => Bind(continuation2(result), continuation)
                        ).toProgramView(),
            }),
    })
}

// Program.prototype.interpretM :: Program a ~> ??? -> ??? b
//
// Program.prototype.interpretM inteprets the program monadically (sequentially)
// according to the `transformation`. Note: `transformation` should yield a
// monadic interface for each constructor - it must also contain a `Return`
// constructor.
Program.prototype.interpretM = function(transformation) {
    return this.toProgramView().cata({
        // 1-1 conversion
        Return: (value) =>
            transformation.Return(value),
        // obtain what the instruction is supposed to be from `transformation`
        // and pass that along to the continuation and repeat
        Continue: (instruction, continuation) =>
            instruction.cata(transformation)
            .chain(result => continuation(result).interpretM(transformation)),
    })
}

// Program.interpretM is a convenience function to interpret a program.
Program.interpretM = program => transformation => program.interpretM(transformation)


// makeInstructions builds instructions (`Program.Instr`) from a sum type (args
// normally passed to daggy.taggedSum).
function makeInstructions(name, constructors) {
    function instructions() {
        throw new TypeError('Instruction was called instead of one of its properties')
    }

    const representation = daggy.taggedSum(name, constructors)

    // wrap all constructors with `Instr`
    for (let key in constructors) {
        if (!constructors[key].length)
            instructions[key] = Instr(representation[key])
        else
            instructions[key] = (...args) => Instr(representation[key](...args))
    }
    return instructions
}

module.exports = {
    ProgramView,
    Program,
    makeInstructions,
}
