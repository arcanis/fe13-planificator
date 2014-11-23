var Character = function ( env, name, parents ) {

    // We set it as enumerable:false so that Angular does not see it, and does not dirty-check it
    Object.defineProperty( this, 'env', { get : function ( ) { return env; }, enumerable : false } );

    this.name = name;

    this.parents = parents;
    this.children = [ ];

    this.classes = _.unique( [ ].concat( this.env.data.Characters[ this.name ].Classes || [ ], _.flatten( this.parents.map( function ( name ) { return this.env.registry[ name ].getBequeathedClasses( this ); }, this ) ) ) );

    this.availableSkills = _.unique( [ ].concat( this.env.data.Characters[ this.name ].Skills || [ ], _.flatten( this.classes.map( function ( name ) { return this.env.data.Classes[ name ].Skills; }, this ) ), _.flatten( this.parents.map( function ( name ) { return this.env.registry[ name ].availableSkills; }, this ) ) ) );
    this.enabledSkills = [ ];

};

Character.prototype.link = function ( other ) {

    if ( this.significantOther !== undefined || ( other && other.significantOther !== undefined ) )
        return ;

    if ( other !== null ) {

        this.significantOther = other.name;
        other.significantOther = this.name;

        this.onLink( );
        other.onLink( );

    } else {

        this.significantOther = null;

    }

};

Character.prototype.unlink = function ( ) {

    if ( this.significantOther === undefined )
        return ;

    if ( this.significantOther !== null ) {

        var other = this.env.registry[ this.significantOther ];

        this.significantOther = undefined;
        other.significantOther = undefined;

        this.onUnlink( );
        other.onUnlink( );

    } else {

        this.significantOther = undefined;

    }

};

Character.prototype.canSupportWith = function ( other ) {

    if ( other === null ) return true;

    return this.env.data.Characters[ this.name ].Supports.indexOf( other.name ) !== -1;

};

Character.prototype.canLinkWith = function ( other ) {

    if ( ! this.canSupportWith( other ) )
        return false;

    if ( other === null )
        return this.significantOther == null;

    if ( this.significantOther === other.name )
        return true;

    if ( this.significantOther !== undefined || other.significantOther !== undefined )
        return false;

    return true;

};

Character.prototype.getBequeathedClasses = function ( child ) {

    var childGender = this.env.data.Characters[ child.name ].Gender;
    var replacementField = { 'Male' : 'Sons', 'Female' : 'Daughters' }[ childGender ];
    var replacements = this.env.data.Characters[ this.name ][ replacementField ] || { };

    return this.classes.map( function ( name ) {
        return replacements[ name ] === undefined ? name : replacements[ name ];
    }, this ).filter( function ( name ) {
        return name !== null;
    }, this ).filter( function ( name ) {
        return this.env.data.Classes[ name ].Inherited !== false;
    }, this );

};

Character.prototype.onLink = function ( ) {

    var data = this.env.data.Characters[ this.name ];
    var children = data.Children || [ ];

    children.forEach( function ( name ) {
        this.env.registry[ name ] = new Character( this.env, name, [ this.name, this.significantOther ] );
    }, this );

};

Character.prototype.onUnlink = function ( ) {

    this.children.forEach( function ( name ) {
        this.env.registry[ name ].unlink( );
        delete this.env.registry[ name ];
    } );

};

function setHashFromRegistry( registry ) {

    var serialized = { };
    var names = Object.keys( registry );

    names.forEach( function ( name ) {

        if ( registry[ name ].significantOther === undefined && registry[ name ].enabledSkills.length === 0 )
            return ;

        serialized[ name ] = [
            registry[ name ].significantOther === undefined ? 0 : registry[ name ].significantOther,
            registry[ name ].enabledSkills
        ];

    } );

    window.location.hash = '#' + encodeURIComponent( JSON.stringify( serialized ) );

}

function setRegistryFromHash( registry ) {

    var unserialized = JSON.parse( decodeURIComponent( window.location.hash.substr( 1 ) ) );
    var names = Object.keys( unserialized );

    while ( names.length > 0 ) {

        var lastLength = names.length;

        names = names.filter( function ( name ) {

            if ( ! registry[ name ] )
                return true;

            var entry = unserialized[ name ];

            if ( entry[ 0 ] && ! registry[ entry[ 0 ] ] )
                return true;

            if ( entry[ 0 ] !== 0 )
                registry[ name ].link( entry[ 0 ] !== null ? registry[ entry[ 0 ] ] : null );

            registry[ name ].enabledSkills = entry[ 1 ];

            return false;

        } );

        if ( lastLength === names.length ) {
            throw new Error( 'Infinite loading : ' + JSON.stringify( names ) );
        }

    }

}

var app = angular.module( 'fe13', [ ] );

app.filter( 'escape', function ( ) {

    return function ( value ) {
        return encodeURIComponent( value );
    };

} );

app.filter( 'canSupportWith', function ( ) {

    return function ( array, other ) {
        return array.filter( function ( character ) {
            return character.canSupportWith( other );
        } );
    };

} );

app.controller( 'loader', function ( $http, $scope ) {

    $http.get( 'awakening.yml' ).then( function ( response ) {
        $scope.env = { registry : { }, data : YAML.parse( response.data ) };
    } );

} );

app.controller( 'main', function ( $scope ) {

    $scope.env.data.Initial.forEach( function ( name ) {
        $scope.env.registry[ name ] = new Character( $scope.env, name, [ ] ); } );

    try { setRegistryFromHash( $scope.env.registry ); } catch ( e ) { console.log( e ); }

    var getCharacterList = function ( ) { return Object.keys( $scope.env.registry ).sort( ).map( function ( name ) { return $scope.env.registry[ name ]; } ); };
    $scope.characters = getCharacterList( );

    $scope.toggleSkill = function ( character, skill ) {

        var hasSkill = character.enabledSkills.indexOf( skill ) !== -1;

        if ( hasSkill ) {
            character.enabledSkills = character.enabledSkills.filter( function ( other ) { return other !== skill; } );
        } else if ( character.enabledSkills.length < 5 ) {
            character.enabledSkills.push( skill );
        }

    };

    $scope.toggleLink = function ( a, b ) {

        if ( ! a.canLinkWith( b ) )
            return ;

        var bName = b === null ? null : b.name;

        if ( a.significantOther !== bName ) {
            a.link( b );
        } else {
            a.unlink( );
        }

        $scope.characters = getCharacterList( );

    };

    $scope.$watch( 'characters', function ( ) {
        setHashFromRegistry( $scope.env.registry );
    }, true );

} );
