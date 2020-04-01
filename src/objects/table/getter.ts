/* --------------------- COPIED FROM THE POSTGRESQL DOCS (v11)

CREATE FUNCTION defines a new function. CREATE OR REPLACE FUNCTION will either create a new function,
or replace an existing definition. To be able to define a function, the user must have the
USAGE privilege on the language.

If a schema name is included, then the function is created in the specified schema. Otherwise it is created
in the current schema. The name of the new function must not match any existing function with the same
input argument types in the same schema. However, functions of different argument types 
can share a name (this is called overloading).

To replace the current definition of an existing function, use CREATE OR REPLACE FUNCTION. It is not 
possible to change the name or argument types of a function this way (if you tried, you would actually 
be creating a new, distinct function). Also, CREATE OR REPLACE FUNCTION will not let you change the 
return type of an existing function. To do that, you must drop and recreate the function. (When 
using OUT parameters, that means you cannot change the types of any OUT parameters except by dropping the function.)

When CREATE OR REPLACE FUNCTION is used to replace an existing function, the ownership and permissions
of the function do not change. All other function properties are assigned the values specified or implied 
in the command. You must own the function to replace it (this includes being a member of the owning role).

If you drop and then recreate a function, the new function is not the same entity as the old; you will have to
drop existing rules, views, triggers, etc. that refer to the old function. Use CREATE OR REPLACE FUNCTION to
change a function definition without breaking objects that refer to the function. Also, ALTER FUNCTION can be 
used to change most of the auxiliary properties of an existing function.

The user that creates the function becomes the owner of the function.

To be able to create a function, you must have USAGE privilege on the argument types and the return type.

*/

// export const reconcileGetter = ()
