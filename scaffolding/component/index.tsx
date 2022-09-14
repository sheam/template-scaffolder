import * as React from 'react';
import {ReactElement} from 'react';
import {use$Component$Styles} from './styles';

interface IComponentProps
{
}

export const $Component$ = ({}: IComponentProps): ReactElement => {

    use$Component$Styles();

    return (
        <div data-testid="component">
        </div>
    );
};
