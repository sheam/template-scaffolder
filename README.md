# Introduction 
Scaffolding templates for your project. 
Make sure your team is using the same patterns by using scaffolding templates.
Quickly create multiple files based on simple templates.
Access to environment variables, users prompts, and scripting.

# Getting Started
1. Create a `scaffolding` directory in the root of your project.
2. Create a sub-folder in the in your _scaffolding_ folder for each template.
3. In the template folder add a `scaffolding.config.js` file with a default
   export that returns a `IConfig` object.
4. Add 1 or more files to the _template_ folder. 
   The template files can contain `$VARIABLE$` that will be replaced by
   the scaffolder when it is run.
5. (optional) Add a script to your `package.json` file to run the scaffolder.

# Command Line
The structure of running the **scaffolder** is as follows:
```bash
scaffolder [destinationDirectory] [--template=<templateName>] [--name=<NAME>] [--dryRun]
```
## Arguments
All arguments to the command line are optional.
If you do not supply the arguments on the command line, 
you will be prompted for their values.

### Destination Directory
Directory which is the root of where generated files will be placed.
If you specify this value on the command line, _it must be the first argument_.
If it is not specified, the user will be prompted input a value.

### template
Name of the template to use for generating files. This will be the name of a
sub-folder in the **scaffolding** directory.
If it is not specified, the user will be prompted input a value.

### name
Value for the NAME variable.
If it is not specified, the user will be prompted input a value.

### dryRun
If this flag is specified, no files or directories will be created.
The contents of what would have been written will be dumped to the console.

# Config files
There will be one of these for each template.
It is a javascript file with a default export that is a function
that takes the `name` parameter and returns a `IConfig` object.

Because this is a regular javascript file, you have access to
`process.env`, and any other javascript functions.

## Configuration options
All fields are optional.

### `variables` _(optional)_
An object where the key is the variable name, 
and the value is the replacement value when encountered in template.
If it is omitted, only the `$NAME$` replacement will happen.

### `destinations` _(optional)_
An array of string which should be used as a root destination for the
files generated by the scaffolder when it is run.
If the user does not want to use one of these destinations, they will
be allowed to select **Other**, and enter their own directory.

### `createNameDir`  _(defaults to `true`)_
By default, the scaffolder will create a directory at the root of the
destination folder named by the value you enter for the `NAME` variable.
The template files will be placed in this created directory.
If you do not want this to happen, set this value to `false`.

### `srcRoot` _(defaults to `./src` or `process.cwd()`)
When the user is being prompted to enter a destination directory,
only directories under the **srcRoot** directory will be available.
By default, the `src` directory in the root of your project will be used 
if one exists. If you do not have a `src` directory, then the current
working directory will be used.

Use this value if you need something other than the defaults.

### `afterFileCreated` _(optional)_
If you need some special processing after a file has been scaffolded, you can
use this *async* function.
It will execute after each file is created, supplying the path and object
containing the variables value. The path will be relative.

An example would be adding the created file to _git_, a _project file_, 
run a formatter on the file, etc.

The function _must return a `Promise`_.

**Note:** In the case of a _dry run_, the file will not actually be created,
so you may want to guard against this in your function.

### `prompts` _(optional)_
If your template requires variable values to be entered by the user,
you may prompt the user. This is an array of `DistinctQuestion` objects,
as defined by the Inquirer user prompter.

For a simple question, you will just need two values: 
```javascript
{ 
  name: 'MYVAR',
  message: 'Enter a value for My Var:'
}
```
You can offer multiple choice like this:
```javascript
{
    name: 'MYVAR',
    message: 'Enter a value for My Var:',
    type: 'list',
    choices: [ 'option 1', 'option 2' ],
}
```
There are a lot of advanced questions types, including conditional questions 
that are supported. To see the complete documentation on what type of
question prompts are supported, visit
[Inquirer documentation](https://github.com/SBoudrias/Inquirer.js#questions).
Note that the only plugin supported is **inquirer-fuzzy-path**.

## Sample `scaffolding.config.js` File
The following is a sample configuration file for a React project.
```javascript
// IConfig
// {
//     variables?: any,
//     destinations?: string[];
//     prompts?: DistinctQuestion[];
//     createNameDir?: boolean;
//     srcRoot?: string;
//     afterFileCreated?: (createdFilePath: string, variables: any) => Promise<void>;
// }

function addToGit(path) {
    console.log(`>>> Added ${path} to git`);
}

export default function (name, variables) {
    return {
        variables: {
            Component: name,
            TEST_ID: name.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase(),
        },
        prompts: [
            {
                name: 'PROPNAME',
                message: 'Enter name of first prop:',
            }
        ],
        destinations: ['src/common/components', 'src/pages'],
        createNameDir: true,
        srcRoot: './src',
        afterFileCreated: addToGit,
    };
};
```

# Making A Template
Variable substitution occurs on file and directory names,
and on the file contents. A variable name must be surrounded by `$`.
**e.g.,** if you had a variable named `MYVAR`, in your wherever `$MYVAR$`
is encountered, it will be replaced with the value of `MYVAR`.
1. Create a folder in the **scaffolding** directory.
2. Create a `scaffolding.config.js` file, and configure it as above.
3. Add files and directories that you will want generated 
   when executing the template.

## Parts of the Template

### Directories
The _scaffolder_ will generate directories to match what is in the template dir.
The name of the directories can contain variable names that will be substituted.

**e.g.,** a template file with the path `component/$SUB_COMPONENT$/index.tsx`  
will result in a file created with a path of 
`src/MySubComponent/index.tsx`, assuming you had a variable named 
`SUB_COMPONENT`, and the template folder was `component`, and srcRoot was `src`.

### Template Files
File names may contain variable names that will be substituted.

**e.g.,** a template file with the path `component/$NAME$.tsx` will result in
a file created with the path of `src/MyComponent.tsx`, assuming you had 
a variable named `SUB_COMPONENT`, and the template folder was `component`, 
and srcRoot was `src`.

### File Contents
Within your template, all variable names surround by `$` will be replaced
with the value of the variable as entered by the user.

## Sample Template
The following is a directory structure for a React project.
It supplies two templates: **component** and **page**.

```text
- projectRoot
  - scaffolding
    - component
      - __tests__
        - $NAME$.test.tsx
      $NAME$.tsx
      helpers.tsx
      styles.ts
      scaffolding.config.js
    - page
      $NAME$.tsx
      scaffolding.config.js
  - src
    - common
      - components 
```
