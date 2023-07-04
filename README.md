# H5P Sort Paragraphs
Let students sort paragraphs into the correct order.

PLEASE NOTE: THIS CONTENT TYPE IS THE RESULT OF CONTRACT WORK WITH SPECIFIC
REQUIREMENTS THAT MAY NOT MATCH YOUR OWN EXPECTATIONS. WHILE OLIVER IS THE
DEVELOPER, HE'S MERELY THE CONTRACTOR WHO ALSO HAPPENED TO PLEAD FOR MAKING 
THIS CONTENT TYPE OPENLY AVAILABLE - SO YOU CAN USE IT FOR FREE. HOWEVER, HE
IS NOT SUPPOSED TO PROVIDE FREE SUPPORT, ACCEPT FEATURE REQUESTS OR PULL 
REQUESTS. HE MAY DO SO, AND HE WILL PROBABLY ALSO CONTINUE WORKING ON THE 
CONTENT TYPE, BUT AT HIS OWN PACE.

## Getting started
Clone this repository with git and check out the branch that you are interested
in (or choose the branch first and then download the archive, but learning
how to use git really makes sense).

Change to the repository directory and run
```bash
npm install
```

to install required modules. Afterwards, you can build the project using
```bash
npm run build
```

or, if you want to let everything be built continuously while you are making
changes to the code, run
```bash
npm run watch
```
Before putting the code in production, you should always run `npm run build`.

The build process will transpile ES6 to earlier versions in order to improve
compatibility to older browsers. If you want to use particular functions that
some browsers don't support, you'll have to add a polyfill.

The build process will also move the source files into one distribution file and
minify the code.


## Reporting
Sort the paragraphs, like other H5P content types, uses the [xAPI](https://xapi.com/overview/)
standard to transfer information about the user experience to a LRS or other platform
collecting data.

The results are modeled for an [xAPI interaction type](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#interaction-activities)
of `sequencing`. However that interaction type does not cover all the features that
Sort the Paragraphs support, so reporting from the xAPI results blindly may fall short.
These two cases may need to be covered separately by reporting that is generated from
the results: scoring mode of "correct sequence" and treating duplicates identically.

### Scoring mode of "correct sequence"
The author can set the content type to not count correctly placed paragraphs, but to
count correct sequences or the correct transition from one paragraph to another
regardless of the exact position that they are placed to. That's a pedagogical
decision.

For instance, if there were five items to sort, the correct order would be
```
1 -> 2 -> 3 -> 4 -> 5
```
The user may have sorted them as
```
2 -> 3 -> 4 -> 5 -> 1
```
If the correct position would be evaluated, no paragraph would be in the correct spot.
The user would receive a score of 0/5 even though the sequencial logic is essentially
right. If the author set the scoring mode to be "correct sequence", then the answer's
transitions will be evaluated. The fully correct answer contains the four transitions
```
1 -> 2
2 -> 3
3 -> 4
4 -> 5
```
and the user's given answer contains
```
2 -> 3
3 -> 4
4 -> 5
5 -> 1
```
in this mode, `2 -> 3`, `3 -> 4`, and `4 -> 5` are correct and counted, so the user
scores 3/4.

In order for the reporting to know that the sequences need to be counted, an
xAPI extension is used:
```
object.definition.extensions["https://h5p.org/x-api/sequencing-type"]: "transitions"
```

### Treating duplicates identically
There are sorting tasks that can contain duplicates, and in that case, it hardly ever
(never?) makes sense to distinguish between them. If, for instance, the user was asked
to sort notes into a melody, notes are likely to appear more than once, but it's
not required to place one "c-major" in one particular spot and one "c-major" in
another spot. Those can be uses interchangeably.

In order for the reporting to know that duplicates can be used interchangeably, an
xAPI extension is used:
```
object.definition.extensions["https://h5p.org/x-api/duplicates-interchangeable"]: 1

```
