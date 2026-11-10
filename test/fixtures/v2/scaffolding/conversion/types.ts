// this is a prompted value: $PromptedType


#foreach($interface in $INTERFACES)
    interface $interface.name {
        #foreach($field in $interface.fields)
           $field.name: $field.typeName;
        #end
    }
#end
