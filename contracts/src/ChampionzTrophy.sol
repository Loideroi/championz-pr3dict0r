// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ChampionzTrophy — the Ultimate ₵h@mpi0n's crown (ADR-0008)
/// @notice One zero-fund ERC-721 per season, minted by the owner to the best
///         combined Stage 1 + Stage 2 score. No money attached — ownable,
///         screenshot-able bragging rights with a negligible attack surface.
contract ChampionzTrophy is ERC721, Ownable {
    uint256 public nextId = 1;
    mapping(uint256 => string) public seasonOf;

    event TrophyMinted(uint256 indexed tokenId, address indexed champion, string season);

    constructor(address owner_) ERC721(unicode"₵h@mpi0nz Trophy", "CHMPNZ") Ownable(owner_) {}

    function mint(address champion, string calldata season) external onlyOwner returns (uint256 id) {
        id = nextId++;
        seasonOf[id] = season;
        _safeMint(champion, id);
        emit TrophyMinted(id, champion, season);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(
            "data:application/json;utf8,",
            '{"name":"Ultimate ',
            unicode"₵h@mpi0n",
            " ",
            seasonOf[tokenId],
            '","description":"Best combined season score, ',
            unicode"₵h@mpi0nz Pr3dict0r",
            '. Zero funds attached; eternal glory included."}'
        );
    }
}
