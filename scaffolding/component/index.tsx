import * as React from 'react';
import {ReactElement} from 'react';
import {use$Component$Styles} from './styles';

interface I$Component$Props
{
}

export const $Component$ = ({}: I$Component$Props): ReactElement => {

    use$Component$Styles();

    return (
        <div data-testid="component">
        </div>
    );
};
